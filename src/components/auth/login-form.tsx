"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LogIn, ShieldCheck, Sparkles, UserRound } from "lucide-react";

export function LoginForm() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось войти");
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось войти");
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark"><Sparkles size={18} /></span><strong>Flowboard</strong></div>
        <div className="login-heading"><div><ShieldCheck size={22} /></div><h1>Вход в рабочее пространство</h1><p>Используйте email или логин, выданный администратором.</p></div>
        <form className="login-form" onSubmit={submit}>
          <label className="field"><span>Email или логин</span><div className="login-input"><UserRound size={16} /><input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required autoFocus /></div></label>
          <label className="field"><span>Пароль</span><div className="login-input"><KeyRound size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="button primary login-submit" type="submit" disabled={pending}><LogIn size={16} />{pending ? "Проверяем…" : "Войти"}</button>
        </form>
        <div className="login-security"><ShieldCheck size={13} /><span>Доступ проверяется сервером при каждом запросе. Удалённые аккаунты блокируются сразу.</span></div>
      </section>
    </main>
  );
}
