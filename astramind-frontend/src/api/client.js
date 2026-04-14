// ── API Base URL ─────────────────────────────────────────────────────────────
// In production (Vercel), VITE_API_URL is set as an environment variable.
// In development (local), defaults to localhost.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

// ── Standard REST call ─────────────────────────────────────────────────────
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',   // ← Always include cookies (required for HTTP-only session cookie)
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'API Error');
  return data;
};

// ── SSE Streaming call ─────────────────────────────────────────────────────
export const sseCall = async (
  endpoint,
  payload,
  onMessage,
  onComplete,
  onError,
  ctrl,
) => {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: ctrl?.signal,
      credentials: 'include',   // ← required for cookie session
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { detail = (await response.json()).detail || detail; } catch {}
      throw new Error(detail);
    }

    // Read the FULL response body at once (most reliable across browsers and CORS configs)
    const text = await response.text();

    // Parse SSE lines: "data: {"content": "..."}"
    let fullContent = '';
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;

      try {
        const parsed = JSON.parse(raw);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content != null) fullContent += parsed.content;
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
        fullContent += raw;
      }
    }

    if (fullContent) onMessage(fullContent);
    if (onComplete) onComplete();

  } catch (err) {
    if (err.name === 'AbortError') return;
    if (onError) onError(err);
    else if (onComplete) onComplete();
  }
};
