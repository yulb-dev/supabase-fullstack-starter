import { createAuthClient } from 'better-auth/react';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'http://localhost:4000';

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  fetchOptions: {
    credentials: 'include',
  },
});

export const isApiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL);
