"""
routers/auth.py — Secure Session Management via HTTP-only Cookies

Provides two endpoints:
  POST /api/v1/auth/session  — validates a GitHub PAT and stores it in a
                               secure, HTTP-only cookie (never accessible to JS)
  DELETE /api/v1/auth/session — clears the cookie on logout

The cookie approach eliminates the localStorage XSS vector where an attacker
script could exfiltrate the token. HTTP-only cookies are invisible to JS and
are automatically sent with every authenticated request.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

logger = logging.getLogger("astramind.routers.auth")

router = APIRouter()

COOKIE_NAME = "astramind_pat"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


class SessionRequest(BaseModel):
    pat: str


@router.post("/auth/session", summary="Create a secure session from a GitHub PAT")
async def create_session(body: SessionRequest, response: Response):
    """
    Validates the GitHub PAT by calling the GitHub API.
    On success, stores the PAT in a secure HTTP-only cookie.
    Returns the GitHub user profile without ever exposing the PAT to the frontend JS.
    """
    pat = body.pat.strip()
    if not pat:
        raise HTTPException(status_code=400, detail="PAT must not be empty.")

    # Validate the PAT against GitHub
    async with httpx.AsyncClient(timeout=10) as client:
        gh_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {pat}",
                "Accept": "application/vnd.github+json",
            },
        )

    if gh_resp.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Invalid GitHub Personal Access Token. Check the token and its scopes.",
        )

    user = gh_resp.json()

    # Store PAT in HTTP-only, Secure, SameSite=None cookie
    # SameSite=None is REQUIRED when frontend (Vercel) and backend (Render) are on different domains.
    # SameSite=None MUST be paired with Secure=True (HTTPS only).
    response.set_cookie(
        key=COOKIE_NAME,
        value=pat,
        max_age=COOKIE_MAX_AGE,
        httponly=True,       # ← JS cannot read this cookie (prevents XSS theft)
        secure=True,         # ← Only sent over HTTPS (both Render and Vercel use HTTPS)
        samesite="none",     # ← Allows cross-site requests (Vercel → Render)
        path="/",
    )

    logger.info("Session created for GitHub user: %s", user.get("login"))

    # Return user info (but NOT the token — frontend never sees it in JS)
    return {
        "ok": True,
        "user": {
            "login": user.get("login"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "email": user.get("email"),
        },
    }


@router.get("/auth/me", summary="Return current session user from cookie")
async def get_me(request: Request):
    """
    Reads the PAT from the HTTP-only cookie (set during login),
    fetches fresh GitHub user info, and returns the profile.
    Used to restore session on page reload without touching localStorage.
    """
    pat = request.cookies.get(COOKIE_NAME)
    if not pat:
        raise HTTPException(status_code=401, detail="No active session. Please log in.")

    async with httpx.AsyncClient(timeout=10) as client:
        gh_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {pat}",
                "Accept": "application/vnd.github+json",
            },
        )

    if gh_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    user = gh_resp.json()
    return {
        "ok": True,
        "user": {
            "login": user.get("login"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "email": user.get("email"),
        },
        # Return pat in response so frontend can still use it for direct GitHub API calls
        # (e.g. fetching repo list). This is safe as it's a response body, not localStorage.
        "token": pat,
    }


@router.delete("/auth/session", summary="Destroy the current session cookie")
async def destroy_session(response: Response):
    """
    Clears the HTTP-only session cookie on logout.
    """
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )
    return {"ok": True, "message": "Logged out successfully."}
