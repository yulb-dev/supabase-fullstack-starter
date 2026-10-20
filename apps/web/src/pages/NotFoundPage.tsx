import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="center-stage">
      <section className="setup-card">
        <div className="brand-mark">S</div>
        <p className="eyebrow">404 · PAGE NOT FOUND</p>
        <h1>这里还没有页面</h1>
        <p className="muted">地址可能已经变更，或者页面还没有加入应用路由。</p>
        <Link className="button primary" to="/">返回首页</Link>
      </section>
    </main>
  );
}
