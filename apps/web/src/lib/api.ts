const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'http://localhost:4000';

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new Error(errorPayload?.error?.message ?? `API request failed (${response.status})`);
  }
  return payload as T;
}
