// Optional. The library only needs a function ({ state, questions }) => Promise<{ answers, usage?, model? }>.
// This one talks to server/d1_server.py on this machine. There is no fallback route on purpose:
// if the local model is down the call fails, rather than the text going anywhere else.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function createLocalClient({ url = 'http://127.0.0.1:8411/v1/systemone', timeoutMs = 120_000 } = {}) {
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) throw new Error(`createLocalClient only sends text to this machine, not to ${hostname}.`);
  const evaluate = async request => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      // A redirect would carry the text to wherever it points.
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      // Only the error code is read; the body is never surfaced.
      const body = await response.json().catch(() => null);
      const error = new Error(`Local d1 server HTTP ${response.status}. Is server/d1_server.py running?`);
      if (body?.error === 'max_tokens_exceeded') error.code = 'max_tokens_exceeded';
      throw error;
    }
    return { ...(await response.json()), provider: 'local' };
  };
  return Object.assign(evaluate, { endpoint: url, model: 'd1-2B', provider: 'local' });
}
