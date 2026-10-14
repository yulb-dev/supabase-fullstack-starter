import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { authClient, isApiConfigured } from './lib/auth-client';

type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  session: { user: AuthUser } | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { data, isPending } = authClient.useSession();
  const session = data ? { user: { id: data.user.id, email: data.user.email } } : null;

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading: isPending,
    configured: isApiConfigured,
    async signIn(email, password) {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message || '登录失败，请检查邮箱和密码。');
    },
    async signUp(email, password) {
      const { error } = await authClient.signUp.email({
        name: email.split('@')[0] || 'New user',
        email,
        password,
      });
      if (error) throw new Error(error.message || '注册失败，请重试。');
      return false;
    },
    async signOut() {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message || '退出登录失败。');
    },
  }), [session, isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
