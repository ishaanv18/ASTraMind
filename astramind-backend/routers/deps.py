"""
routers/deps.py — Dependency Risk Radar (Feature 5)
POST /api/v1/deps/analyze — parse deps, fetch metadata, CVE check, stream AI risk report
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException
from ai_client import ai
from config import settings
from database_client import db
from models.schemas import DependencyInfo, DepsAnalyzeRequest, DepsAnalyzeResponse

router = APIRouter()
logger = logging.getLogger("astramind.routers.deps")

DEPS_ANALYSIS_SYSTEM = (
    "Dependency security expert. Be CONCISE. Use bullet points only, no prose.\n\n"
    "## Risk Score\n"
    "Score: X/100\nReason: one sentence max.\n\n"
    "## Real CVEs Found\n"
    "Only list CVEs that appear in the report above. Format: `CVE-ID | package@version | severity | fix: upgrade to X`\n"
    "If no CVEs in report, write: No CVEs found in OSV database for these packages.\n\n"
    "## Upgrade Recommendations\n"
    "For each OUTDATED package: `package: current -> latest (action)`\n\n"
    "## Action Plan\n"
    "1. [step]\n2. [step]\n3. [step]"
)



# ══════════════════════════════════════════════════════════════════════════════
# Dependency file parsers
# ══════════════════════════════════════════════════════════════════════════════

def _parse_requirements_txt(content: str) -> List[Tuple[str, Optional[str]]]:
    """Parse requirements.txt → [(package_name, version_or_None)]."""
    deps: List[Tuple[str, Optional[str]]] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Handle: package==1.0, package>=1.0, package~=1.0, package
        match = re.match(r"^([A-Za-z0-9_\-\.]+)\s*(?:[><=!~^]+\s*([^\s;#]+))?", line)
        if match:
            name = match.group(1).strip()
            version = match.group(2).strip() if match.group(2) else None
            # Clean semver operators
            if version:
                version = re.sub(r"^[><=!~^]+", "", version).strip()
            deps.append((name, version))
    return deps


def _parse_package_json(content: str) -> List[Tuple[str, Optional[str]]]:
    """Parse package.json → [(package_name, version_or_None)]."""
    import json as json_mod
    deps: List[Tuple[str, Optional[str]]] = []
    try:
        data = json_mod.loads(content)
    except json_mod.JSONDecodeError:
        return deps

    for section in ("dependencies", "devDependencies", "peerDependencies"):
        for name, version in data.get(section, {}).items():
            clean = re.sub(r"^[><=!~^]", "", str(version)).strip()
            deps.append((name, clean or None))
    return deps


def _parse_pyproject_toml(content: str) -> List[Tuple[str, Optional[str]]]:
    """Parse pyproject.toml → [(package_name, version_or_None)]."""
    deps: List[Tuple[str, Optional[str]]] = []
    # Match lines like: package = ">=1.0" or package = {version = "^1.0"}
    simple = re.findall(r'^([A-Za-z0-9_\-\.]+)\s*=\s*"([^"]+)"', content, re.MULTILINE)
    for name, version in simple:
        if name in ("name", "version", "description", "authors", "readme", "python"):
            continue
        clean = re.sub(r"^[><=!~^]+", "", version).strip()
        deps.append((name, clean or None))
    return deps


def _parse_pom_xml(content: str) -> List[Tuple[str, Optional[str]]]:
    """Parse Maven pom.xml → [(artifactId, version_or_None)]."""
    deps: List[Tuple[str, Optional[str]]] = []
    # Extract <dependency> blocks
    dep_blocks = re.findall(r'<dependency>(.*?)</dependency>', content, re.DOTALL)
    for block in dep_blocks:
        artifact_match = re.search(r'<artifactId>([^<]+)</artifactId>', block)
        version_match = re.search(r'<version>([^<]+)</version>', block)
        if artifact_match:
            name = artifact_match.group(1).strip()
            version = version_match.group(1).strip() if version_match else None
            deps.append((name, version))
    return deps


def _auto_parse(content: str, file_type: Optional[str]) -> List[Tuple[str, Optional[str]]]:
    """Auto-detect format and parse."""
    if not file_type:
        # Heuristic detection
        if '"dependencies"' in content or '"devDependencies"' in content:
            file_type = "package_json"
        elif "[tool.poetry" in content or "[project]" in content:
            file_type = "pyproject"
        elif "<artifactId>" in content or "<dependency>" in content:
            file_type = "pom"
        else:
            file_type = "requirements"

    if file_type == "package_json":
        return _parse_package_json(content)
    elif file_type == "pyproject":
        return _parse_pyproject_toml(content)
    elif file_type == "pom":
        return _parse_pom_xml(content)
    return _parse_requirements_txt(content)


# ══════════════════════════════════════════════════════════════════════════════
# External API calls (all free, no auth)
# ══════════════════════════════════════════════════════════════════════════════

async def _fetch_pypi_info(client: httpx.AsyncClient, name: str) -> Dict[str, Any]:
    """Fetch latest version, license, last release date from PyPI JSON API."""
    try:
        resp = await client.get(
            f"https://pypi.org/pypi/{name}/json",
            timeout=8.0,
        )
        if resp.status_code != 200:
            return {}
        data = resp.json()
        info = data.get("info", {})
        releases = data.get("releases", {})
        # Get date of latest version upload
        latest = info.get("version", "")
        last_date = ""
        if latest and latest in releases:
            release_files = releases[latest]
            if release_files:
                last_date = release_files[0].get("upload_time", "")[:10]
        return {
            "latest_version": latest,
            "license": info.get("license") or "unknown",
            "last_release_date": last_date,
        }
    except Exception as exc:
        logger.debug("PyPI fetch failed for %s: %s", name, exc)
        return {}


async def _fetch_npm_info(client: httpx.AsyncClient, name: str) -> Dict[str, Any]:
    """Fetch latest version, license, last modified from npm registry."""
    try:
        resp = await client.get(
            f"https://registry.npmjs.org/{name}",
            timeout=8.0,
        )
        if resp.status_code != 200:
            return {}
        data = resp.json()
        dist_tags = data.get("dist-tags", {})
        latest = dist_tags.get("latest", "")
        time_data = data.get("time", {})
        last_date = ""
        if latest and latest in time_data:
            last_date = time_data[latest][:10]
        versions = data.get("versions", {})
        license_info = "unknown"
        if latest and latest in versions:
            license_info = versions[latest].get("license", "unknown")
        return {
            "latest_version": latest,
            "license": str(license_info),
            "last_release_date": last_date,
        }
    except Exception as exc:
        logger.debug("npm fetch failed for %s: %s", name, exc)
        return {}


async def _fetch_maven_info(client: httpx.AsyncClient, artifact_id: str) -> Dict[str, Any]:
    """Fetch latest version and metadata from Maven Central for a given artifactId."""
    try:
        resp = await client.get(
            f"https://search.maven.org/solrsearch/select?q=a:%22{artifact_id}%22&rows=1&wt=json",
            timeout=8.0,
        )
        if resp.status_code != 200:
            return {}
        data = resp.json()
        docs = data.get("response", {}).get("docs", [])
        if not docs:
            return {}
        doc = docs[0]
        return {
            "latest_version": doc.get("latestVersion", ""),
            "license": doc.get("p", "unknown"),
            "last_release_date": "",
        }
    except Exception as exc:
        logger.debug("Maven Central fetch failed for %s: %s", artifact_id, exc)
        return {}


async def _check_cves(
    client: httpx.AsyncClient, name: str, version: Optional[str], ecosystem: str = "PyPI"
) -> List[Dict[str, Any]]:

    """
    Query OSV.dev API for known CVEs/vulnerabilities for a package.
    Uses the correct ecosystem (PyPI, npm, Maven, etc.).
    """
    try:
        payload: Dict[str, Any] = {"package": {"name": name, "ecosystem": ecosystem}}
        if version:
            payload["version"] = version
        resp = await client.post(
            "https://api.osv.dev/v1/query",
            json=payload,
            timeout=8.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        vulns = data.get("vulns", [])
        result = []
        for v in vulns[:5]:  # cap at 5 CVEs per package
            aliases = v.get("aliases", [])
            cve_ids = [a for a in aliases if a.startswith("CVE-")]
            severity = "UNKNOWN"
            for sev in v.get("severity", []):
                if sev.get("type") == "CVSS_V3":
                    score = float(sev.get("score", 0) or 0)
                    if score >= 9.0:
                        severity = "CRITICAL"
                    elif score >= 7.0:
                        severity = "HIGH"
                    elif score >= 4.0:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    break
            result.append({
                "id": v.get("id", ""),
                "cve_ids": cve_ids,
                "severity": severity,
                "summary": v.get("summary", "")[:200],
                "published": v.get("published", "")[:10],
            })
        return result
    except Exception as exc:
        logger.debug("OSV CVE check failed for %s: %s", name, exc)
        return []


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/deps/analyze",
    summary="Dependency risk analysis: CVEs, outdated packages, AI risk report (SSE)",
)
async def analyze_dependencies(request: DepsAnalyzeRequest):
    """
    Parses a requirements.txt / package.json / pyproject.toml,
    fetches live metadata from PyPI/npm, checks OSV.dev for CVEs,
    then streams an AI risk report with:
    - Overall risk score 0-100
    - Top 3 critical CVEs to fix immediately
    - Replacement packages for risky deps
    - Safe auto-upgrade candidates
    """
    logger.info(
        "[DEPS] repo_id=%s file_type=%s content_len=%s",
        request.repo_id,
        request.file_type,
        len(request.file_content or ""),
    )

    # Resolve file content
    dep_content: Optional[str] = request.file_content
    file_type: Optional[str] = request.file_type

    if not dep_content and request.repo_id:
        # Try to auto-detect dependency file in indexed repo
        try:
            repo = await db.get_repository(request.repo_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Database error: {exc}")
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

        repo_path = repo.get("repo_path", "")
        CANDIDATE_FILES = [
            ("requirements.txt", "requirements"),
            ("requirements/base.txt", "requirements"),
            ("package.json", "package_json"),
            ("pyproject.toml", "pyproject"),
        ]
        import os
        for fname, ftype in CANDIDATE_FILES:
            fpath = os.path.join(repo_path, fname)
            if os.path.exists(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8") as fh:
                        dep_content = fh.read()
                    file_type = ftype
                    logger.info("[DEPS] Auto-detected: %s (%s)", fname, ftype)
                    break
                except OSError:
                    continue

    if not dep_content:
        raise HTTPException(
            status_code=422,
            detail="Provide file_content or a repo_id with an indexed repository containing a dependency file.",
        )

    # Parse dependencies
    raw_deps = _auto_parse(dep_content, file_type)
    if not raw_deps:
        raise HTTPException(
            status_code=400,
            detail="No dependencies found in the provided file content.",
        )

    # Cap at 30 packages to stay within free rate limits
    raw_deps = raw_deps[:30]
    logger.info("[DEPS] Fetching metadata for %d packages...", len(raw_deps))

    # Determine ecosystem for CVE check and metadata source
    is_npm = file_type == "package_json"
    is_maven = file_type == "pom"
    if is_maven:
        cve_ecosystem = "Maven"
    elif is_npm:
        cve_ecosystem = "npm"
    else:
        cve_ecosystem = "PyPI"

    # Fetch metadata + CVEs concurrently
    dep_infos: List[DependencyInfo] = []
    async with httpx.AsyncClient(
        headers={"User-Agent": "astramind/1.0"},
        follow_redirects=True,
    ) as client:
        tasks = []
        for name, version in raw_deps:
            if is_npm:
                tasks.append(_fetch_npm_info(client, name))
            elif is_maven:
                tasks.append(_fetch_maven_info(client, name))
            else:
                tasks.append(_fetch_pypi_info(client, name))
            tasks.append(_check_cves(client, name, version, cve_ecosystem))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Pair up results (fetch_info, cves) per package
    for i, (name, version) in enumerate(raw_deps):
        meta_result = results[i * 2]
        cve_result = results[i * 2 + 1]

        meta: Dict[str, Any] = meta_result if isinstance(meta_result, dict) else {}
        cves: List[Dict[str, Any]] = cve_result if isinstance(cve_result, list) else []

        # Calculate days since last release
        days_since: Optional[int] = None
        last_release = meta.get("last_release_date", "")
        if last_release:
            from datetime import date
            try:
                release_date = date.fromisoformat(last_release)
                days_since = (date.today() - release_date).days
            except ValueError:
                pass

        dep_infos.append(
            DependencyInfo(
                name=name,
                current_version=version,
                latest_version=meta.get("latest_version"),
                license=meta.get("license"),
                last_release_date=last_release or None,
                cves=cves,
                days_since_release=days_since,
            )
        )

    # Build report for AI
    report_lines = [f"# Dependency Report ({len(dep_infos)} packages)\n"]
    for dep in dep_infos:
        cve_summary = ""
        if dep.cves:
            cve_summary = f" | ⚠ {len(dep.cves)} CVE(s): " + ", ".join(
                f"{c['id']}({c['severity']})" for c in dep.cves[:3]
            )
        outdated = ""
        if dep.current_version and dep.latest_version and dep.current_version != dep.latest_version:
            outdated = f" | OUTDATED: {dep.current_version} → {dep.latest_version}"
        abandoned = ""
        if dep.days_since_release and dep.days_since_release > 365:
            abandoned = f" | STALE: {dep.days_since_release}d since last release"

        report_lines.append(
            f"- **{dep.name}** {dep.current_version or 'unpinned'}"
            f" | License: {dep.license or 'unknown'}"
            + outdated
            + abandoned
            + cve_summary
        )

    report_text = "\n".join(report_lines)
    user_prompt = (
        f"{report_text}\n\n"
        "Provide your risk assessment now."
    )

    logger.info(
        "[DEPS] Metadata collected. CVE packages: %d. Calling AI.",
        sum(1 for d in dep_infos if d.cves),
    )

    try:
        ai_analysis = await ai.call(DEPS_ANALYSIS_SYSTEM, user_prompt, max_tokens=900)
    except Exception as exc:
        ai_analysis = f"AI analysis failed: {exc}"

    return {
        "dependencies": [d.model_dump() for d in dep_infos],
        "total": len(dep_infos),
        "cve_count": sum(len(d.cves) for d in dep_infos),
        "analysis": ai_analysis,
    }


@router.post(
    "/deps/metadata",
    response_model=DepsAnalyzeResponse,
    summary="Get raw dependency metadata without AI analysis",
)
async def get_deps_metadata(request: DepsAnalyzeRequest) -> DepsAnalyzeResponse:
    """
    Returns parsed dependency information (versions, licenses, CVEs, staleness)
    without streaming. Useful for populating a dashboard table.
    """
    logger.info("[DEPS/META] Fetching raw metadata only.")

    dep_content = request.file_content
    if not dep_content:
        raise HTTPException(status_code=422, detail="file_content is required for this endpoint.")

    raw_deps = _auto_parse(dep_content, request.file_type)[:30]
    if not raw_deps:
        raise HTTPException(status_code=400, detail="No dependencies found.")

    is_npm = request.file_type == "package_json"
    dep_infos: List[DependencyInfo] = []

    async with httpx.AsyncClient(headers={"User-Agent": "astramind/1.0"}) as client:
        tasks = []
        for name, version in raw_deps:
            tasks.append(_fetch_npm_info(client, name) if is_npm else _fetch_pypi_info(client, name))
            tasks.append(_check_cves(client, name, version))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, (name, version) in enumerate(raw_deps):
        meta: Dict[str, Any] = results[i * 2] if isinstance(results[i * 2], dict) else {}
        cves: List = results[i * 2 + 1] if isinstance(results[i * 2 + 1], list) else []
        days_since = None
        last_release = meta.get("last_release_date", "")
        if last_release:
            from datetime import date
            try:
                days_since = (date.today() - date.fromisoformat(last_release)).days
            except ValueError:
                pass
        dep_infos.append(
            DependencyInfo(
                name=name,
                current_version=version,
                latest_version=meta.get("latest_version"),
                license=meta.get("license"),
                last_release_date=last_release or None,
                cves=cves,
                days_since_release=days_since,
            )
        )

    return DepsAnalyzeResponse(dependencies=dep_infos, total=len(dep_infos))
