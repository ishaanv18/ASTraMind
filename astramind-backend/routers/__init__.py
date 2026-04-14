# routers/__init__.py
# Makes all router modules importable from `from routers import ...`
from . import (
    index,
    search,
    debug,
    diff,
    deps,
    architecture,
    onboard,
    security,
    tests,
    review,
    timemachine,
    trends,
    nl_query,
    adr,
    pair,
    commits,
)

__all__ = [
    "index",
    "search",
    "debug",
    "diff",
    "deps",
    "architecture",
    "onboard",
    "security",
    "tests",
    "review",
    "timemachine",
    "trends",
    "nl_query",
    "adr",
    "pair",
    "commits",
]
