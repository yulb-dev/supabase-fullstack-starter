import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const authState = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
  loading: false,
  configured: false,
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(false),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./AuthProvider', () => ({
  useAuth: () => authState,
}));

afterEach(() => {
  cleanup();
  authState.session = null;
  authState.loading = false;
  authState.configured = false;
  vi.clearAllMocks();
});

describe('App', () => {
  it('explains the environment configuration needed before login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '配置数据库与 API' })).toBeTruthy();
    expect(screen.getByText(/apps\/api\/\.env/)).toBeTruthy();
    expect(screen.getByText(/数据库连接串只放在/)).toBeTruthy();
  });

  it('submits email and password to the auth provider', async () => {
    authState.configured = true;
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('邮箱'), 'dev@example.com');
    await user.type(screen.getByLabelText('密码'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(authState.signIn).toHaveBeenCalledWith('dev@example.com', 'correct-horse-battery');
    });
  });
});
