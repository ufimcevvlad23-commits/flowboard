"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="empty-workspace"><div className="brand-mark large">!</div><h1>Что-то пошло не так</h1><p>Данные в браузере сохранены. Попробуйте перезапустить интерфейс.</p><button className="button primary" onClick={reset}><RotateCcw size={16} />Повторить</button></main>;
}
