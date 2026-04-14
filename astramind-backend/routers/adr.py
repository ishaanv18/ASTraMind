"""
routers/adr.py — Auto ADR Generator (Advanced Feature 4)
POST /api/v1/adr/generate — scan git history, generate Architecture Decision Records
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


from fastapi import APIRouter, HTTPException

from ai_client import ai
from database_client import db
from models.schemas import ADRDocument, ADRGenerateRequest, ADRGenerateResponse
from parser.git_analyzer import GitAnalyzer

router = APIRouter()
logger = logging.getLogger("astramind.routers.adr")


ADR_GENERATION_SYSTEM = (
    "You are a principal engineer writing an Architecture Decision Record (ADR). "
    "Generate a professional ADR based on the git changes provided. "
    "Follow this EXACT format:\n\n"
    "# ADR-NNNN: [Descriptive Title]\n\n"
    "## Status\nAccepted\n\n"
    "## Date\n[inferred date]\n\n"
    "## Context\n"
    "[What situation or problem drove this decision? What were the constraints? "
    "2-4 sentences.]\n\n"
    "## Decision\n"
    "[What was decided and how was it implemented? Be specific about the technical choice. "
    "2-4 sentences.]\n\n"
    "## Consequences\n"
    "### Positive\n- [benefit 1]\n- [benefit 2]\n\n"
    "### Negative / Trade-offs\n- [trade-off 1]\n- [trade-off 2]\n\n"
    "## Alternatives Considered\n"
    "- [alternative 1 and why it was rejected]\n\n"
    "## Related\n"
    "- Commit(s): [commit hashes]\n\n"
    "Return ONLY the ADR markdown. No preamble, no trailing commentary."
)

TITLE_EXTRACTION_SYSTEM = (
    "Extract a short ADR title from this content. "
    "Format: 'verb noun phrase', e.g. 'Use FastAPI for REST API', 'Adopt Redis for caching'. "
    "Return ONLY the title, nothing else. Max 8 words."
)

CONFIDENCE_SYSTEM = (
    "Rate how confident you are that this set of git changes represents a deliberate "
    "architectural decision worth documenting as an ADR. "
    "Return ONLY a number between 0 and 1 (e.g. 0.85). No explanation."
)


def _slugify(title: str) -> str:
    """Convert a title to a filename-safe slug."""
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug[:60]


async def _generate_single_adr(
    group: Dict[str, Any],
    index: int,
) -> Optional[ADRDocument]:
    """
    Generate a single ADR document for a group of related commits.
    Returns None if confidence is below threshold.
    """
    # Build context for the AI
    commit_messages = "\n".join(
        f"- [{h}] {msg}"
        for h, msg in zip(
            group.get("commit_hashes", []),
            group.get("commit_messages", []),
        )
    )
    files_str = "\n".join(f"  - {f}" for f in group.get("files_changed", [])[:15])
    signals_str = "\n".join(f"  - {s}" for s in group.get("signals", []))

    context_prompt = (
        f"## Inferred Date\n{group.get('inferred_date', 'Unknown')[:10]}\n\n"
        f"## Commit Messages ({group.get('commit_count', 0)} commits)\n{commit_messages}\n\n"
        f"## Files Changed\n{files_str}\n\n"
        f"## Structural Change Signals\n{signals_str}\n\n"
        "Write the ADR now."
    )

    # Run ADR generation and confidence scoring in parallel
    try:
        adr_content, confidence_raw = await asyncio.gather(
            ai.call_with_retry(ADR_GENERATION_SYSTEM, context_prompt, max_tokens=1000),
            ai.call_with_retry(
                CONFIDENCE_SYSTEM,
                f"Changes: {commit_messages}\nSignals: {signals_str}",
                max_tokens=10,
            ),
        )
    except Exception as exc:
        logger.warning("[ADR] Generation failed for group %d: %s", index, exc)
        return None

    # Parse confidence
    confidence = 0.5
    try:
        confidence = float(confidence_raw.strip())
        confidence = max(0.0, min(1.0, confidence))
    except ValueError:
        pass

    # Skip low-confidence ADRs
    if confidence < 0.4:
        logger.info(
            "[ADR] Skipping group %d (confidence=%.2f < 0.4)", index, confidence
        )
        return None

    # Extract title from ADR content
    title_line = ""
    for line in adr_content.strip().splitlines():
        if line.startswith("# ADR"):
            title_line = line.replace("#", "").strip()
            # Remove numeric prefix if present: "ADR-0001: Use FastAPI" → "Use FastAPI"
            title_line = re.sub(r"^ADR-?\d*:?\s*", "", title_line).strip()
            break

    if not title_line:
        # Fallback: ask AI for a title
        try:
            title_line = await ai.call_with_retry(
                TITLE_EXTRACTION_SYSTEM, adr_content[:500], max_tokens=30
            )
            title_line = title_line.strip().strip('"').strip("'")
        except Exception:
            title_line = f"Architectural Change {index:04d}"

    adr_num = f"{index:04d}"
    slug = _slugify(title_line)
    filename = f"{adr_num}-{slug}.md"

    # Replace placeholder ADR number in content
    final_content = re.sub(
        r"# ADR-?NNNN:?", f"# ADR-{adr_num}:", adr_content
    )

    return ADRDocument(
        title=title_line,
        filename=filename,
        content=final_content,
        inferred_date=group.get("inferred_date", "Unknown")[:10],
        confidence_score=round(confidence, 2),
    )


# ══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/adr/generate",
    response_model=ADRGenerateResponse,
    summary="Auto-generate Architecture Decision Records from git history",
)
async def generate_adrs(request: ADRGenerateRequest) -> ADRGenerateResponse:
    """
    Scans git history to detect major structural changes
    (new directories, dependency changes, large refactors, config additions),
    groups related commits within 3-day windows,
    and generates one ADR per group using AI.

    Returns:
    - adrs: list of ADR documents with content, date, and confidence score
    - folder_structure: {filename: content} dict ready to write to /docs/adr/
    """
    logger.info("[ADR] Generate: repo_id=%s", request.repo_id)

    # Validate repo
    try:
        repo = await db.get_repository(request.repo_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    if repo is None:
        raise HTTPException(status_code=404, detail=f"Repository {request.repo_id} not found.")

    repo_path = repo.get("repo_path", "")
    loop = asyncio.get_event_loop()

    # Detect structural changes in git history (up to 2 years back)
    logger.info("[ADR] Scanning git history for structural changes...")
    try:
        change_groups = await loop.run_in_executor(
            None,
            GitAnalyzer.detect_structural_changes,
            repo_path,
            730,  # 2 years
        )
    except Exception as exc:
        logger.warning("[ADR] Git history scan unavailable: %s", exc)
        # ── No-git fallback: generate ADRs from code structure analysis ──────
        logger.info("[ADR] Falling back to code-structure ADR generation...")
        repo_path_full = repo.get("repo_path", "")
        repo_name = repo.get("name", "this repository")
        language_summary = repo.get("language_summary", {})

        # Detect tech stack signals by scanning files
        signals = []
        files_seen: List[str] = []
        try:
            for root, dirs, fnames in os.walk(repo_path_full):
                dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "build", "target", "dist", "__pycache__", ".gradle"}]
                for fn in fnames:
                    files_seen.append(fn.lower())
        except Exception:
            pass

        fnames_set = set(files_seen)
        if any("dockerfile" in f for f in fnames_set):
            signals.append("Uses Docker for containerization (Dockerfile detected)")
        if any(f in fnames_set for f in ("pom.xml", "build.gradle", "build.gradle.kts")):
            signals.append("Uses Maven/Gradle as Java build tool")
        if "package.json" in fnames_set:
            signals.append("Uses Node.js/npm (package.json detected)")
        if any(f in fnames_set for f in ("docker-compose.yml", "docker-compose.yaml")):
            signals.append("Uses Docker Compose for multi-service orchestration")
        if any(f.endswith(".java") for f in fnames_set):
            signals.append("Java backend (Spring Boot detected from file structure)")
        if any(f.endswith((".jsx", ".tsx")) for f in fnames_set):
            signals.append("React frontend (JSX/TSX files detected)")
        if any(f.endswith(".kt") for f in fnames_set):
            signals.append("Kotlin files detected (JVM language)")
        if any("application.properties" in f or "application.yml" in f for f in fnames_set):
            signals.append("Spring Boot configuration (application.properties/yml)")
        if any(f in fnames_set for f in ("requirements.txt", "pyproject.toml")):
            signals.append("Python project (requirements.txt detected)")

        lang_str = ", ".join(f"{k} ({v} files)" for k, v in
                             sorted(language_summary.items(), key=lambda x: -x[1])[:6]) or "mixed"

        structure_prompt = (
            f"Repository: {repo_name}\n"
            f"Languages detected: {lang_str}\n"
            f"Architectural signals:\n" +
            "\n".join(f"- {s}" for s in signals) +
            f"\n\nBased on these signals, write exactly 2 concise ADRs for the most important "
            f"technology choices. Use this format for each:\n\n"
            "# ADR-NNNN: [Title]\n## Status\nAccepted\n## Date\n2024-01-01\n"
            "## Context\n[2 sentences]\n## Decision\n[2 sentences]\n"
            "## Consequences\n### Positive\n- [benefit]\n### Negative\n- [trade-off]\n\n"
            "Separate the two ADRs with '---'."
        )

        adrs: List[ADRDocument] = []
        try:
            raw = await ai.call(ADR_GENERATION_SYSTEM[:400], structure_prompt, max_tokens=480)
            # Split by separator
            adr_parts = [p.strip() for p in raw.split("---") if p.strip()]
            for idx, part in enumerate(adr_parts[:3], 1):
                if not part.strip():
                    continue
                # Extract title
                title_line = "Architectural Decision"
                for line in part.splitlines():
                    if line.startswith("# ADR"):
                        title_line = re.sub(r"^#\s*ADR-?\d*:?\s*", "", line).strip()
                        break
                final = re.sub(r"# ADR-?NNNN:?", f"# ADR-{idx:04d}:", part)
                slug = _slugify(title_line)
                adrs.append(ADRDocument(
                    title=title_line,
                    filename=f"{idx:04d}-{slug}.md",
                    content=final,
                    inferred_date=datetime.utcnow().strftime("%Y-%m-%d"),
                    confidence_score=0.75,
                ))
        except Exception as ai_exc:
            logger.error("[ADR] Code-structure ADR generation failed: %s", ai_exc)

        folder_structure: Dict[str, str] = {
            "README.md": (
                f"# Architecture Decision Records — {repo_name}\n\n"
                f"Generated by Astramind (code-structure analysis — no git history available).\n\n"
                "## Index\n" +
                "".join(f"- [{a.title}](./{a.filename}) — confidence: {a.confidence_score:.0%}\n" for a in adrs)
                + ("\n*Note: These ADRs were inferred from code structure, not git history.*\n" if adrs else
                   "No ADRs could be generated. Add source files and re-index.\n")
            ),
            "ADR-0000-template.md": (
                "# ADR-NNNN: [Title]\n\n## Status\nProposed\n\n## Date\nYYYY-MM-DD\n\n"
                "## Context\n[Problem]\n\n## Decision\n[Decision]\n\n"
                "## Consequences\n### Positive\n- \n\n### Negative\n- \n"
            ),
        }
        for adr in adrs:
            folder_structure[adr.filename] = adr.content

        logger.info("[ADR] Code-structure fallback complete. Generated %d ADRs.", len(adrs))
        return ADRGenerateResponse(
            repo_id=request.repo_id,
            adrs=adrs,
            folder_structure=folder_structure,
            total=len(adrs),
        )



    if not change_groups:
        return ADRGenerateResponse(
            repo_id=request.repo_id,
            adrs=[],
            folder_structure={
                "README.md": (
                    "# Architecture Decision Records\n\n"
                    "No significant structural changes detected in git history.\n\n"
                    "ADRs can be manually created using the ADR-0001-template.md format.\n"
                )
            },
            total=0,
        )

    logger.info("[ADR] Found %d change groups. Generating ADRs...", len(change_groups))

    # Generate ADRs for all groups concurrently (but cap at 10 to avoid rate limits)
    groups_to_process = change_groups[:10]
    adr_tasks = [
        _generate_single_adr(group, idx + 1)
        for idx, group in enumerate(groups_to_process)
    ]

    adr_results = await asyncio.gather(*adr_tasks, return_exceptions=True)

    adrs: List[ADRDocument] = []
    for result in adr_results:
        if isinstance(result, Exception):
            logger.warning("[ADR] ADR generation task failed: %s", result)
            continue
        if result is not None:
            adrs.append(result)

    # Sort by date (oldest first — ADRs should be chronological)
    adrs.sort(key=lambda a: a.inferred_date)

    # Re-number after sorting
    for i, adr in enumerate(adrs, 1):
        new_num = f"{i:04d}"
        old_num = re.search(r"ADR-(\d+)", adr.filename)
        if old_num:
            old_str = old_num.group(0)
            adr.filename = adr.filename.replace(old_str, f"ADR-{new_num}", 1)
            adr.content = adr.content.replace(old_str, f"ADR-{new_num}", 1)

    # Build folder structure
    folder_structure: Dict[str, str] = {}

    # README index
    readme_lines = [
        "# Architecture Decision Records\n",
        f"Generated by Astramind on {datetime.utcnow().strftime('%Y-%m-%d')}.\n",
        f"Repository: `{repo.get('name', request.repo_id)}`\n\n",
        "## Index\n",
    ]
    for adr in adrs:
        readme_lines.append(
            f"- [{adr.title}](./{adr.filename}) "
            f"— {adr.inferred_date} (confidence: {adr.confidence_score:.0%})\n"
        )
    folder_structure["README.md"] = "".join(readme_lines)

    # Template
    folder_structure["ADR-0000-template.md"] = (
        "# ADR-NNNN: [Title]\n\n"
        "## Status\nProposed | Accepted | Deprecated | Superseded\n\n"
        "## Date\nYYYY-MM-DD\n\n"
        "## Context\n[Problem or situation driving this decision]\n\n"
        "## Decision\n[The decision made]\n\n"
        "## Consequences\n### Positive\n- \n\n### Negative\n- \n\n"
        "## Alternatives Considered\n- \n\n"
        "## Related\n- \n"
    )

    # Individual ADR files
    for adr in adrs:
        folder_structure[adr.filename] = adr.content

    logger.info(
        "[ADR] Complete. Generated %d ADRs from %d change groups.",
        len(adrs),
        len(change_groups),
    )

    return ADRGenerateResponse(
        repo_id=request.repo_id,
        adrs=adrs,
        folder_structure=folder_structure,
        total=len(adrs),
    )
