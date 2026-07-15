import Link from "next/link";

export default function NotFound() {
  return <main className="empty-workspace"><div className="brand-mark large">404</div><h1>Страница не найдена</h1><p>Вернитесь в рабочее пространство Flowboard.</p><Link className="button primary" href="/">На главную</Link></main>;
}
