"""
parser/git_analyzer.py — Git Repository Analysis via GitPython
Provides: cloning, blame, commit history, diffs, most-changed files,
structural change detection for ADR generation, and historical checkout.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

logger = logging.getLogger(__name__)


class _NoGitError(RuntimeError):
    """Raised when git binary is not available on this machine."""
    pass


def _get_repo(repo_local_path: str):
    """Open an existing local git repo. Returns a git.Repo object."""
    try:
        import git  # type: ignore
        import shutil as _shutil

        # 1. Respect explicit env var (works on any OS, any deployment)
        git_exe = os.environ.get("GIT_PYTHON_GIT_EXECUTABLE")

        # 2. Search PATH
        if not git_exe:
            git_exe = _shutil.which("git")

        # 3. Common Windows install locations (fallback for when PATH isn't set)
        if not git_exe:
            _common = [
                r"C:\Program Files\Git\cmd\git.exe",
                r"C:\Program Files\Git\bin\git.exe",
                r"C:\Program Files (x86)\Git\cmd\git.exe",
            ]
            for p in _common:
                if os.path.isfile(p):
                    git_exe = p
                    break

        if not git_exe:
            raise _NoGitError(
                "git binary not found. Install Git (https://git-scm.com) "
                "or set GIT_PYTHON_GIT_EXECUTABLE env var to the git path."
            )

        # Cache in env var so subprocesses and future calls all find it
        os.environ["GIT_PYTHON_GIT_EXECUTABLE"] = git_exe
        git.refresh(git_exe)
        return git.Repo(repo_local_path)
    except _NoGitError:
        raise
    except ImportError:
        raise _NoGitError("gitpython package not installed. Run: pip install gitpython")
    except Exception as exc:
        raise ValueError(f"Could not open git repo at {repo_local_path}: {exc}") from exc



class GitAnalyzer:
    """
    All git operations needed by Astramind routers.
    All methods accept a `repo_local_path` string pointing to a cloned repo on disk.
    """

    # ══════════════════════════════════════════════════════════════════════════
    # Clone
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def clone(github_url: str, dest_path: str) -> str:
        """
        Clone / download a GitHub repo into dest_path.
        Strategy:
          1. Try GitPython (requires git binary in PATH).
          2. If git binary is missing, fall back to downloading the repo
             as a ZIP archive via the GitHub API — no git required.
        Returns the path to the repo directory (idempotent).
        """
        if os.path.exists(dest_path) and os.path.isdir(dest_path) and os.listdir(dest_path):
            logger.info("Repo already exists at %s — skipping clone.", dest_path)
            return dest_path

        os.makedirs(dest_path, exist_ok=True)

        # ── Strategy 1: GitPython ───────────────────────────────────────────
        try:
            import git  # type: ignore
            # Try to locate git executable in common Windows locations
            _common_git_paths = [
                r"C:\Program Files\Git\cmd\git.exe",
                r"C:\Program Files\Git\bin\git.exe",
                r"C:\Program Files (x86)\Git\cmd\git.exe",
                r"C:\Users\{}\AppData\Local\Programs\Git\cmd\git.exe".format(os.getenv("USERNAME", "")),
            ]
            git_exe = None
            import shutil as _shutil
            git_exe = _shutil.which("git")
            if not git_exe:
                for p in _common_git_paths:
                    if os.path.isfile(p):
                        git_exe = p
                        break

            if git_exe:
                git.refresh(git_exe)
                logger.info("Cloning %s → %s (git: %s)", github_url, dest_path, git_exe)
                git.Repo.clone_from(github_url, dest_path, depth=100)
                logger.info("Clone complete: %s", dest_path)
                return dest_path
            else:
                logger.warning("git binary not found — falling back to ZIP download.")
        except Exception as exc:
            logger.warning("GitPython clone failed (%s) — falling back to ZIP download.", exc)

        # ── Strategy 2: ZIP download (no git required) ──────────────────────
        return GitAnalyzer._download_zip(github_url, dest_path)

    @staticmethod
    def _download_zip(github_url: str, dest_path: str) -> str:
        """
        Download a GitHub repository as a ZIP and extract it.
        Works for any public repo without requiring git.
        Converts https://github.com/owner/repo[.git] to the archive URL.
        """
        import urllib.request
        import zipfile
        import io

        # Normalise URL  →  owner/repo
        url = github_url.rstrip("/").removesuffix(".git")
        parts = url.rstrip("/").split("/")
        if len(parts) < 2:
            raise ValueError(f"Cannot parse GitHub URL: {github_url}")
        owner, repo_name = parts[-2], parts[-1]

        zip_url = f"https://github.com/{owner}/{repo_name}/archive/refs/heads/main.zip"
        logger.info("Downloading ZIP from %s", zip_url)

        try:
            with urllib.request.urlopen(zip_url, timeout=120) as resp:
                zip_data = resp.read()
        except Exception:
            # Try 'master' branch as fallback
            zip_url = f"https://github.com/{owner}/{repo_name}/archive/refs/heads/master.zip"
            logger.info("Retrying with master branch: %s", zip_url)
            with urllib.request.urlopen(zip_url, timeout=120) as resp:
                zip_data = resp.read()

        logger.info("ZIP downloaded (%d bytes) — extracting…", len(zip_data))
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            # ZIPs from GitHub contain a top-level folder like "repo-main/"
            # We want to strip that prefix so dest_path IS the repo root.
            names = zf.namelist()
            top_dir = names[0].split("/")[0] if names else ""
            for member in names:
                member_path = member
                # Strip the top-level folder prefix
                if top_dir and member_path.startswith(top_dir + "/"):
                    member_path = member_path[len(top_dir) + 1:]
                if not member_path:
                    continue
                target = os.path.join(dest_path, member_path)
                if member.endswith("/"):
                    os.makedirs(target, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with zf.open(member) as src, open(target, "wb") as dst:
                        dst.write(src.read())

        logger.info("ZIP extraction complete → %s", dest_path)
        return dest_path

    # ══════════════════════════════════════════════════════════════════════════
    # Diffs
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_diff(repo_local_path: str, base: str, compare: str) -> str:
        """
        Return unified diff string between two branches/commits.
        Example: get_diff(path, "main", "feature/auth")
        """
        repo = _get_repo(repo_local_path)
        try:
            diff_text = repo.git.diff(base, compare)
            return diff_text
        except Exception as exc:
            logger.warning("git diff failed (%s..%s): %s", base, compare, exc)
            return ""

    @staticmethod
    def get_staged_diff(repo_local_path: str) -> str:
        """Return the diff of all staged (index) changes vs HEAD."""
        repo = _get_repo(repo_local_path)
        try:
            return repo.git.diff("HEAD")
        except Exception as exc:
            logger.warning("git diff HEAD failed: %s", exc)
            return ""

    # ══════════════════════════════════════════════════════════════════════════
    # Commit history
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_recent_commits(
        repo_local_path: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Return the last N commits as dicts:
        {hash, short_hash, message, author, date_iso, files_changed}
        """
        repo = _get_repo(repo_local_path)
        commits = []
        for commit in repo.iter_commits(max_count=limit):
            try:
                files_changed = list(commit.stats.files.keys())[:20]  # cap per commit
            except Exception:
                files_changed = []
            commits.append(
                {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": commit.message.strip(),
                    "author": str(commit.author),
                    "date_iso": datetime.fromtimestamp(commit.committed_date).isoformat(),
                    "files_changed": files_changed,
                }
            )
        return commits

    @staticmethod
    def get_commits_since_date(
        repo_local_path: str, since: datetime
    ) -> List[Dict[str, Any]]:
        """
        Return all commits since a given datetime.
        Used by quality trend tracker and ADR generator.
        """
        repo = _get_repo(repo_local_path)
        commits = []
        for commit in repo.iter_commits():
            commit_dt = datetime.fromtimestamp(commit.committed_date)
            if commit_dt < since:
                break
            try:
                files_changed = list(commit.stats.files.keys())[:30]
            except Exception:
                files_changed = []
            commits.append(
                {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": commit.message.strip(),
                    "author": str(commit.author),
                    "date_iso": commit_dt.isoformat(),
                    "committed_date": commit.committed_date,
                    "files_changed": files_changed,
                    "stats": {
                        "insertions": commit.stats.total.get("insertions", 0),
                        "deletions": commit.stats.total.get("deletions", 0),
                        "files": commit.stats.total.get("files", 0),
                    },
                }
            )
        return commits

    # ══════════════════════════════════════════════════════════════════════════
    # Blame
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_blame(
        repo_local_path: str, file_path: str, line_start: int, line_end: int
    ) -> List[Dict[str, Any]]:
        """
        Return git blame for specified line range in a file.
        Returns: [{line_number, commit_hash, author, date_iso, content}]
        """
        repo = _get_repo(repo_local_path)
        blame_entries: List[Dict[str, Any]] = []
        try:
            blame = repo.blame("HEAD", file_path)
            current_line = 1
            for commit, lines in blame:
                for line_bytes in lines:
                    if line_start <= current_line <= line_end:
                        blame_entries.append(
                            {
                                "line_number": current_line,
                                "commit_hash": commit.hexsha[:8],
                                "author": str(commit.author),
                                "date_iso": datetime.fromtimestamp(
                                    commit.committed_date
                                ).isoformat(),
                                "content": (
                                    line_bytes.decode("utf-8", errors="replace")
                                    if isinstance(line_bytes, bytes)
                                    else str(line_bytes)
                                ),
                            }
                        )
                    current_line += 1
                    if current_line > line_end:
                        break
                if current_line > line_end:
                    break
        except Exception as exc:
            logger.warning("git blame failed for %s: %s", file_path, exc)
        return blame_entries

    # ══════════════════════════════════════════════════════════════════════════
    # Most-changed files (for onboarding)
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_most_changed_files(
        repo_local_path: str, limit: int = 20, top_n: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Count how many commits touched each file across the last `limit` commits.
        Returns top_n files sorted by change frequency descending.
        """
        repo = _get_repo(repo_local_path)
        file_counts: Dict[str, int] = {}
        for commit in repo.iter_commits(max_count=limit):
            try:
                for file_path in commit.stats.files.keys():
                    file_counts[file_path] = file_counts.get(file_path, 0) + 1
            except Exception:
                continue
        sorted_files = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)
        return [
            {"file_path": fp, "change_count": count}
            for fp, count in sorted_files[:top_n]
        ]

    # ══════════════════════════════════════════════════════════════════════════
    # Structural change detection (ADR generator)
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def detect_structural_changes(
        repo_local_path: str, days_back: int = 365
    ) -> List[Dict[str, Any]]:
        """
        Walk git history and identify commits that represent major structural changes:
        - New directories added
        - Bulk file renames
        - Large new dependencies (requirements.txt / package.json changed significantly)
        - Files with 80%+ lines changed (major refactor)
        - New config files added

        Groups related changes within 3-day windows.
        Returns list of change-group dicts suitable for ADR generation.
        """
        repo = _get_repo(repo_local_path)
        since = datetime.utcnow() - timedelta(days=days_back)
        raw_commits = []

        for commit in repo.iter_commits():
            commit_dt = datetime.fromtimestamp(commit.committed_date)
            if commit_dt < since:
                break
            try:
                files = commit.stats.files
            except Exception:
                files = {}

            structural_signals = []

            # Check for config/dependency files
            for fp in files:
                lower_fp = fp.lower()
                if any(
                    lower_fp.endswith(dep)
                    for dep in (
                        "requirements.txt",
                        "package.json",
                        "pyproject.toml",
                        "go.mod",
                        "cargo.toml",
                        "pom.xml",
                        "build.gradle",
                        "dockerfile",
                        "docker-compose.yml",
                        ".github/workflows",
                    )
                ):
                    structural_signals.append(f"dependency/config change: {fp}")

            # Large changes (> 100 insertions) in a single file
            for fp, stats in files.items():
                if stats.get("insertions", 0) > 100:
                    structural_signals.append(f"large refactor: {fp} (+{stats['insertions']} lines)")

            # Many files changed at once (bulk rename / restructure)
            if len(files) > 15:
                structural_signals.append(
                    f"bulk change: {len(files)} files modified in one commit"
                )

            if structural_signals:
                raw_commits.append(
                    {
                        "hash": commit.hexsha[:8],
                        "message": commit.message.strip(),
                        "date_iso": commit_dt.isoformat(),
                        "committed_timestamp": commit.committed_date,
                        "signals": structural_signals,
                        "files_changed": list(files.keys())[:30],
                    }
                )

        # Group commits within 3-day windows
        groups = GitAnalyzer._group_by_time(raw_commits, window_days=3)
        return groups

    @staticmethod
    def _group_by_time(
        commits: List[Dict[str, Any]], window_days: int = 3
    ) -> List[Dict[str, Any]]:
        """Cluster commits that fall within `window_days` of each other."""
        if not commits:
            return []
        groups: List[Dict[str, Any]] = []
        current_group: List[Dict[str, Any]] = [commits[0]]
        window_seconds = window_days * 86_400

        for commit in commits[1:]:
            prev_ts = current_group[-1]["committed_timestamp"]
            curr_ts = commit["committed_timestamp"]
            if abs(prev_ts - curr_ts) <= window_seconds:
                current_group.append(commit)
            else:
                groups.append(GitAnalyzer._summarise_group(current_group))
                current_group = [commit]

        if current_group:
            groups.append(GitAnalyzer._summarise_group(current_group))

        return groups

    @staticmethod
    def _summarise_group(commits: List[Dict[str, Any]]) -> Dict[str, Any]:
        all_signals = []
        all_files: List[str] = []
        messages = []
        for c in commits:
            all_signals.extend(c.get("signals", []))
            all_files.extend(c.get("files_changed", []))
            messages.append(c["message"])
        return {
            "inferred_date": commits[0]["date_iso"],
            "commit_count": len(commits),
            "commit_hashes": [c["hash"] for c in commits],
            "commit_messages": messages,
            "signals": list(set(all_signals)),
            "files_changed": list(set(all_files))[:30],
        }

    # ══════════════════════════════════════════════════════════════════════════
    # Historical checkout (Time Machine)
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def checkout_at_date(
        repo_local_path: str, as_of_date: str, temp_dir: str
    ) -> str:
        """
        Create a copy of the repo at the state it was on `as_of_date` (YYYY-MM-DD).
        Does NOT modify the original repo — works in a temp copy.
        Returns path to the temporary repo snapshot.
        """
        import git  # type: ignore

        target_dt = datetime.strptime(as_of_date, "%Y-%m-%d")
        repo = _get_repo(repo_local_path)

        # Find the last commit before/on target date
        target_commit = None
        for commit in repo.iter_commits():
            commit_dt = datetime.fromtimestamp(commit.committed_date)
            if commit_dt <= target_dt:
                target_commit = commit
                break

        if target_commit is None:
            raise ValueError(
                f"No commits found on or before {as_of_date} in {repo_local_path}"
            )

        snapshot_path = os.path.join(temp_dir, f"snapshot_{as_of_date}")
        if os.path.exists(snapshot_path):
            shutil.rmtree(snapshot_path)

        # Clone locally (fast — just copies objects) then checkout target commit
        git.Repo.clone_from(repo_local_path, snapshot_path)
        snapshot_repo = git.Repo(snapshot_path)
        snapshot_repo.git.checkout(target_commit.hexsha)
        logger.info(
            "Checked out snapshot at %s (commit %s) → %s",
            as_of_date,
            target_commit.hexsha[:8],
            snapshot_path,
        )
        return snapshot_path

    # ══════════════════════════════════════════════════════════════════════════
    # Quality metric helpers (used by trends router — pure AST, no AI)
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_file_content_at_commit(
        repo_local_path: str, file_path: str, commit_hash: str
    ) -> Optional[str]:
        """Return the raw text content of a file at a specific commit hash."""
        repo = _get_repo(repo_local_path)
        try:
            blob = repo.commit(commit_hash).tree[file_path]
            return blob.data_stream.read().decode("utf-8", errors="replace")
        except Exception as exc:
            logger.debug("Could not read %s at %s: %s", file_path, commit_hash[:8], exc)
            return None

    @staticmethod
    def list_python_files_at_commit(
        repo_local_path: str, commit_hash: str
    ) -> List[str]:
        """Return all .py file paths present in the repo at a given commit."""
        repo = _get_repo(repo_local_path)
        try:
            commit = repo.commit(commit_hash)
            return [
                item.path
                for item in commit.tree.traverse()
                if item.type == "blob" and item.path.endswith(".py")
            ]
        except Exception as exc:
            logger.warning("list_python_files_at_commit failed: %s", exc)
            return []

    # ══════════════════════════════════════════════════════════════════════════
    # Repo structure summary (used by onboarding)
    # ══════════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_directory_tree(repo_local_path: str, max_depth: int = 3) -> str:
        """
        Returns a textual directory tree (like `tree` command output).
        Limited to max_depth to keep context windows manageable.
        """
        lines: List[str] = []
        root = Path(repo_local_path)
        SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}

        def _walk(path: Path, depth: int, prefix: str) -> None:
            if depth > max_depth:
                return
            try:
                entries = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name))
            except PermissionError:
                return
            for i, entry in enumerate(entries):
                if entry.name in SKIP_DIRS or entry.name.startswith("."):
                    continue
                connector = "└── " if i == len(entries) - 1 else "├── "
                lines.append(f"{prefix}{connector}{entry.name}")
                if entry.is_dir():
                    extension = "    " if i == len(entries) - 1 else "│   "
                    _walk(entry, depth + 1, prefix + extension)

        lines.append(root.name)
        _walk(root, 1, "")
        return "\n".join(lines)


# Module-level singleton
git_analyzer = GitAnalyzer()
