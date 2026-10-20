import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    loading: false,
    configured: false,
    signIn: async () => undefined,
    signUp: async () => false,
    signOut: async () => undefined,
  }),
}));

describe('App setup state', () => {
  it('explains the environment configuration needed before login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '配置数据库与 API' })).toBeTruthy();
    expect(screen.getByText(/apps\/api\/\.env/)).toBeTruthy();
    expect(screen.getByText(/数据库连接串只放在/)).toBeTruthy();
  });
});
