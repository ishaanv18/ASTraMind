"""
routers/security.py — Security Sentinel (Feature 8)
POST /api/v1/security/scan  — static analysis + AI exploit/fix report (SSE)
GET  /api/v1/security/history/{repo_id} — past scan results
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

from ai_client import ai
from database_client import db
from models.schemas import SecurityFinding, SecurityScanRequest, SecurityScanResponse
from parser.tree_sitter_parser import CodeParser

router = APIRouter()
logger = logging.getLogger("astramind.routers.security")


SECURITY_REPORT_SYSTEM = (
    "You are a security auditor. Given these static analysis findings, write a brief security summary."
    " Format: Grade (A-F), top risk in one sentence, one immediate fix to apply."
    " Under 80 words. No preamble."
)


# ══════════════════════════════════════════════════════════════════════════════
# OWASP Top 10 static analysis rules
# ══════════════════════════════════════════════════════════════════════════════

# Each rule: (pattern, cwe_id, severity, description, languages)
SECURITY_RULES: List[Dict[str, Any]] = [
    # SQL Injection
    {
        "pattern": re.compile(
            r'(?:execute|cursor\.execute|query|raw\(|filter\()\s*\(\s*["\'].*%[s|d]|'
            r'f["\'].*SELECT.*\{|'
            r'\"SELECT.*\"\s*\+|'
            r'\.format\(.*\)\s*(?:execute|query)',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-89",
        "severity": "CRITICAL",
        "description": "Potential SQL injection: string formatting used in a database query",
        "languages": {"python", "javascript", "typescript", "java", "php"},
    },
    # Hardcoded secrets
    {
        "pattern": re.compile(
            r'(?:password|passwd|secret|api_key|apikey|token|auth|credential|private_key)\s*'
            r'=\s*["\'][A-Za-z0-9+/=_\-]{8,}["\']',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-798",
        "severity": "HIGH",
        "description": "Hardcoded credential: sensitive value assigned as a string literal",
        "languages": None,  # all languages
    },
    # AWS keys
    {
        "pattern": re.compile(r"AKIA[0-9A-Z]{16}"),
        "cwe_id": "CWE-798",
        "severity": "CRITICAL",
        "description": "Hardcoded AWS Access Key ID detected",
        "languages": None,
    },
    # Generic API key patterns
    {
        "pattern": re.compile(
            r'(?:sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}|xoxb-[0-9]+-[A-Za-z0-9]+)',
        ),
        "cwe_id": "CWE-798",
        "severity": "CRITICAL",
        "description": "Hardcoded API token detected (OpenAI/GitHub/Slack pattern)",
        "languages": None,
    },
    # Shell injection
    {
        "pattern": re.compile(
            r'(?:os\.system|subprocess\.call|subprocess\.run|popen|exec\(|shell=True)\s*\(',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-78",
        "severity": "HIGH",
        "description": "Potential shell injection: user input may reach OS command execution",
        "languages": {"python"},
    },
    # eval() usage
    {
        "pattern": re.compile(r'\beval\s*\(', re.IGNORECASE),
        "cwe_id": "CWE-95",
        "severity": "HIGH",
        "description": "Dangerous eval() call: can execute arbitrary code",
        "languages": {"python", "javascript", "typescript"},
    },
    # Debug mode enabled
    {
        "pattern": re.compile(
            r'(?:DEBUG\s*=\s*True|app\.run\(.*debug\s*=\s*True|NODE_ENV\s*=\s*["\']development["\'])',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-489",
        "severity": "MEDIUM",
        "description": "Debug mode enabled in production configuration",
        "languages": None,
    },
    # CORS wildcard
    {
        "pattern": re.compile(
            r'(?:allow_origins\s*=\s*\[\s*["\']?\s*\*\s*["\']?\s*\]|'
            r'Access-Control-Allow-Origin.*\*|'
            r'cors\(\s*\{[^}]*origin\s*:\s*["\']?\*["\']?)',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-942",
        "severity": "MEDIUM",
        "description": "CORS wildcard (*) allows any origin to access this endpoint",
        "languages": None,
    },
    # Pickle deserialization
    {
        "pattern": re.compile(r'pickle\.loads?\(|cPickle\.loads?\(', re.IGNORECASE),
        "cwe_id": "CWE-502",
        "severity": "HIGH",
        "description": "Unsafe pickle deserialization: can execute arbitrary code from untrusted data",
        "languages": {"python"},
    },
    # XML external entity
    {
        "pattern": re.compile(
            r'etree\.parse\(|xml\.dom\.minidom\.parse|parseString\(|XMLParser\(',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-611",
        "severity": "MEDIUM",
        "description": "XML parser usage detected — verify XXE protection is enabled",
        "languages": {"python", "java"},
    },
    # Path traversal
    {
        "pattern": re.compile(
            r'open\s*\(\s*(?:request\.|user_|input|params|query)',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-22",
        "severity": "HIGH",
        "description": "Potential path traversal: user-controlled input passed to file open()",
        "languages": {"python"},
    },
    # Missing authentication decorator
    {
        "pattern": re.compile(
            r'@(?:app|router)\.(?:post|put|delete|patch)\s*\(["\'][^"\']*(?:admin|user|account|delete|update|create)[^"\']*["\']\)',
            re.IGNORECASE,
        ),
        "cwe_id": "CWE-306",
        "severity": "MEDIUM",
        "description": "Sensitive endpoint may be missing authentication — verify auth decorators are applied",
        "languages": {"python"},
    },
]


def _scan_content(
    content: str,
    file_path: str,
    language: Optional[str],
) -> List[SecurityFinding]:
    """
    Run all security rules against a file's content.
    Returns list of SecurityFinding objects with line numbers.
    """
    findings: List[SecurityFinding] = []
    lines = content.splitlines()

    for rule in SECURITY_RULES:
        # Language filter
        if rule["languages"] and language not in rule["languages"]:
            continue

        pattern: re.Pattern = rule["pattern"]
        for line_num, line in enumerate(lines, start=1):
            if pattern.search(line):
                # Avoid duplicate findings on same line for same CWE
                already = any(
                    f.file_path == file_path
                    and f.line_number == line_num
                    and f.cwe_id == rule["cwe_id"]
                    for f in findings
                )
                if not already:
                    findings.append(
                        SecurityFinding(
                            file_path=file_path,
                            line_number=line_num,
                            severity=rule["severity"],
                            cwe_id=rule["cwe_id"],
                            description=rule["description"],
                            match=line.strip()[:120],
                        )
                    )

    return findings


def _compute_risk_score(findings: List[SecurityFinding]) -> int:
    """
    Compute a risk score 0-100 based on findings.
    CRITICAL=25pts, HIGH=10pts, MEDIUM=5pts, LOW=1pt. Capped at 100.
    """
    weights = {"CRITICAL": 25, "HIGH": 10, "MEDIUM": 5, "LOW": 1}
    score = sum(weights.get(f.severity, 1) for f in findings)
    return min(score, 100)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/security/scan",
    summary="OWASP Top 10 static analysis + AI exploit/fix report (SSE)",
)
async def security_scan(request: SecurityScanRequest):
    """
    Runs AST + regex static analysis for OWASP Top 10 vulnerabilities.
    Accepts either:
    - repo_id: scans all indexed source files
    - code + language: scans a single code snippet

    Saves findings to DB, then returns an AI summary.
    """
    logger.info(
        "[SECURITY] scan: repo_id=%s lang=%s snippet=%s",
        request.repo_id,
        request.language,
        bool(request.code),
    )

    all_findings: List[SecurityFinding] = []

    if request.code:
        # Scan a single snippet
        if not request.language:
            raise HTTPException(
                status_code=422, detail="language is required when providing code snippet."
            )
        all_findings = _scan_content(request.code, "<snippet>", request.language)

    elif request.repo_id:
        # Validate repo
        try:
            repo = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

        repo_path = repo.get("repo_path", "")

        # Walk and scan all files (in executor — blocking I/O)
        loop = asyncio.get_event_loop()

        def _scan_all() -> List[SecurityFinding]:
            results: List[SecurityFinding] = []
            for abs_path, rel_path, language in CodeParser.walk_repo(
                repo_path, max_file_size_kb=300
            ):
                content = CodeParser.read_file(abs_path)
                if not content:
                    continue
                file_findings = _scan_content(content, rel_path, language)
                results.extend(file_findings)
            return results

        try:
            all_findings = await loop.run_in_executor(None, _scan_all)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Scan failed: {exc}")

        # Save scan to DB
        risk_score = _compute_risk_score(all_findings)
        try:
            await db.save_security_scan({
                "repo_id": request.repo_id,
                "findings": [f.model_dump() for f in all_findings],
                "risk_score": risk_score,
            })
        except Exception as exc:
            logger.warning("[SECURITY] Could not save scan results: %s", exc)

    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either repo_id (scan full repo) or code + language (scan snippet).",
        )

    risk_score = _compute_risk_score(all_findings)
    logger.info(
        "[SECURITY] Scan complete. findings=%d risk_score=%d. Calling AI for summary.",
        len(all_findings), risk_score,
    )

    # Build findings summary for AI
    ai_summary = ""
    if not all_findings:
        ai_summary = "No security findings detected."
    else:
        findings_text = f"Risk Score: {risk_score}/100. {len(all_findings)} findings:\n"
        for i, f in enumerate(all_findings[:10], 1):
            findings_text += f"{i}. {f.cwe_id} [{f.severity}] {f.file_path}:{f.line_number} — {f.description}\n"
        try:
            ai_summary = await ai.call(
                SECURITY_REPORT_SYSTEM,
                findings_text + "\nWrite your security summary:",
                max_tokens=200,
            )
        except Exception as exc:
            ai_summary = f"AI summary failed: {exc}"

    return SecurityScanResponse(
        repo_id=request.repo_id or "",
        findings=all_findings[:50],
        total_findings=len(all_findings),
        risk_score=risk_score,
        ai_summary=ai_summary,
    )


@router.get(
    "/security/history/{repo_id}",
    summary="Get security scan history for a repository",
)
async def get_security_history(repo_id: str):
    """Return all past security scan results for a repository."""
    logger.info("[SECURITY] Get history: repo_id=%s", repo_id)
    try:
        repo = await db.get_repository(repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {repo_id} not found.")

    # Fetch scans via raw DB query (re-use existing session)
    try:
        from database_client import SecurityScan as SecurityScanModel
        from sqlalchemy.future import select
        async with db.AsyncSessionLocal() as session:
            result = await session.execute(
                select(SecurityScanModel)
                .where(SecurityScanModel.repo_id == repo_id)
                .order_by(SecurityScanModel.scanned_at.desc())
                .limit(10)
            )
            scans = result.scalars().all()
            scan_list = [db._row_to_dict(s) for s in scans]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return {
        "repo_id": repo_id,
        "scans": scan_list,
        "total": len(scan_list),
    }
