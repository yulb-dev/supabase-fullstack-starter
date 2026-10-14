import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthProvider';
import { apiRequest } from './lib/api';

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

const authSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少需要 8 位'),
});
type AuthValues = z.infer<typeof authSchema>;

export function App() {
  const { session, loading, configured, signIn, signUp, signOut } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';
  const todoKey = ['todos', userId];

  const authForm = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '' },
  });

  const todosQuery = useQuery({
    queryKey: todoKey,
    queryFn: () => apiRequest<Todo[]>('/api/v1/todos'),
    enabled: Boolean(token),
  });

  const createTodo = useMutation({
    mutationFn: (nextTitle: string) => apiRequest<Todo>('/api/v1/todos', {
      method: 'POST', body: JSON.stringify({ title: nextTitle }),
    }),
    onSuccess: async () => {
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: todoKey });
    },
  });

  const updateTodo = useMutation({
    mutationFn: (todo: Pick<Todo, 'id' | 'completed'>) => apiRequest<Todo>(
      `/api/v1/todos/${todo.id}`, {
        method: 'PATCH', body: JSON.stringify({ completed: todo.completed }),
      },
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKey }),
  });

  const deleteTodo = useMutation({
    mutationFn: (id: string) => apiRequest<{ id: string }>(`/api/v1/todos/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKey }),
  });

  if (loading) {
    return <main className="center-stage"><div className="loader" /><p>正在恢复登录状态…</p></main>;
  }

  if (!configured) {
    return (
      <main className="center-stage">
        <section className="setup-card">
          <div className="brand-mark">S</div>
          <p className="eyebrow">STARTER SETUP</p>
          <h1>配置数据库与 API</h1>
          <p className="muted">配置后端 PostgreSQL 连接串和 Better Auth 密钥，并确认前端 API 地址；然后重启开发服务器。</p>
          <pre><code>cp apps/web/.env.example apps/web/.env</code></pre>
          <pre><code>cp apps/api/.env.example apps/api/.env</code></pre>
          <p className="small-note">数据库连接串只放在 <code>apps/api/.env</code>，不要放到任何 VITE_ 变量里。</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="center-stage">
        <section className="auth-card">
          <div className="brand-mark">S</div>
          <p className="eyebrow">POSTGRESQL FULL-STACK STARTER</p>
          <h1>{isRegister ? '创建你的工作空间' : '欢迎回来'}</h1>
          <p className="muted">使用 Better Auth 会话 Cookie 登录，数据通过独立 Fastify API 访问 PostgreSQL。</p>
          <form className="auth-form" onSubmit={authForm.handleSubmit(async (values) => {
            setAuthError('');
            setNotice('');
            try {
              if (isRegister) {
                const needsConfirmation = await signUp(values.email, values.password);
                setNotice(needsConfirmation ? '注册成功，请检查邮箱并完成确认后再登录。' : '注册成功。');
              } else {
                await signIn(values.email, values.password);
              }
            } catch (error) {
              setAuthError(error instanceof Error ? error.message : '操作失败，请重试。');
            }
          })}>
            <label htmlFor="email">邮箱</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...authForm.register('email')} />
            {authForm.formState.errors.email && <p className="field-error">{authForm.formState.errors.email.message}</p>}
            <label htmlFor="password">密码</label>
            <input id="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="至少 8 位" {...authForm.register('password')} />
            {authForm.formState.errors.password && <p className="field-error">{authForm.formState.errors.password.message}</p>}
            {authError && <div className="notice error">{authError}</div>}
            {notice && <div className="notice success">{notice}</div>}
            <button className="button primary full-width" type="submit" disabled={authForm.formState.isSubmitting}>
              {authForm.formState.isSubmitting ? '请稍候…' : isRegister ? '创建账户' : '登录'}
            </button>
          </form>
          <button className="text-button" onClick={() => { setIsRegister(!isRegister); setAuthError(''); setNotice(''); }}>
            {isRegister ? '已有账户？返回登录' : '没有账户？免费注册'}
          </button>
        </section>
      </main>
    );
  }

  const todos = todosQuery.data ?? [];
  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="首页"><span className="brand-mark small">S</span><span>stack<span className="brand-dot">.</span>starter</span></a>
        <div className="account-area">
          <span className="avatar">{(session.user.email?.[0] ?? 'U').toUpperCase()}</span>
          <span className="account-email">{session.user.email}</span>
          <button className="button ghost" onClick={() => void signOut()}>退出登录</button>
        </div>
      </header>

      <section className="welcome-section">
        <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
        <h1>把想法，变成进度。</h1>
        <p className="muted">一个可扩展的全栈起点。试着添加一条 Todo，数据将保存在你的 Supabase PostgreSQL 中。</p>
      </section>

      <section className="stats-grid" aria-label="任务概览">
        <article className="stat-card"><span className="stat-label">全部任务</span><strong>{todos.length}</strong><span className="stat-caption">当前账户</span></article>
        <article className="stat-card"><span className="stat-label">已完成</span><strong>{completedCount}</strong><span className="stat-caption">稳步向前</span></article>
        <article className="stat-card"><span className="stat-label">待完成</span><strong>{todos.length - completedCount}</strong><span className="stat-caption">下一步行动</span></article>
      </section>

      <section className="todo-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">TASK BOARD</p><h2>今日任务</h2></div>
          <span className="pill">{todos.length} 项</span>
        </div>
        <form className="add-form" onSubmit={(event) => {
          event.preventDefault();
          const value = title.trim();
          if (value) createTodo.mutate(value);
        }}>
          <input aria-label="新任务标题" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="添加一条新任务…" />
          <button className="button primary" type="submit" disabled={!title.trim() || createTodo.isPending}>添加任务 <span aria-hidden="true">↗</span></button>
        </form>

        {(createTodo.error || updateTodo.error || deleteTodo.error || todosQuery.error) && (
          <div className="notice error">{(createTodo.error || updateTodo.error || deleteTodo.error || todosQuery.error)?.message}</div>
        )}

        {todosQuery.isPending ? <div className="empty-state"><div className="loader" /><p>正在加载任务…</p></div> :
          todos.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✓</div><h3>从一件小事开始</h3><p>这里还空空的，添加第一条任务吧。</p></div>
          ) : (
            <ul className="todo-list">
              {todos.map((todo) => (
                <li className={`todo-item ${todo.completed ? 'is-complete' : ''}`} key={todo.id}>
                  <button className={`check-button ${todo.completed ? 'checked' : ''}`} aria-label={todo.completed ? '标记为未完成' : '标记为已完成'} onClick={() => updateTodo.mutate({ id: todo.id, completed: !todo.completed })}>
                    {todo.completed ? '✓' : ''}
                  </button>
                  <span className="todo-title">{todo.title}</span>
                  <span className="todo-date">{new Date(todo.createdAt).toLocaleDateString('zh-CN')}</span>
                  <button className="delete-button" aria-label={`删除 ${todo.title}`} onClick={() => deleteTodo.mutate(todo.id)}>删除</button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <footer className="footer"><span>Built with React, Fastify & PostgreSQL</span><a href="http://localhost:4000/openapi.json" target="_blank" rel="noreferrer">查看 API 文档 ↗</a></footer>
    </main>
  );
}
