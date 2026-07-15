"use client";

import { useState } from "react";
import { KeyRound, Mail, ShieldCheck, Trash2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { cn, employeeColor, employeeInitials } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Employee } from "@/types/board";

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  currentUserId: string;
}

export function TeamDialog({ open, onClose, canManage, currentUserId }: TeamDialogProps) {
  const employees = useBoardStore((state) => state.employees);
  const upsertEmployee = useBoardStore((state) => state.upsertEmployee);
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const employeeList = Object.values(employees).sort((a, b) => a.status === b.status ? a.name.localeCompare(b.name, "ru") : a.status === "active" ? -1 : 1);
  const activeCount = employeeList.filter((employee) => employee.status === "active").length;

  const submit = async () => {
    if (!name.trim()) { toast.error("Введите имя сотрудника"); return; }
    if (!identity.trim()) { toast.error("Введите email или логин"); return; }
    if (password.length < 10 || !/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) { toast.error("Пароль: минимум 10 символов, буква и цифра"); return; }
    setSubmitting(true);
    try {
      const login = identity.trim().toLocaleLowerCase("ru");
      const response = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), login, email: login.includes("@") ? login : "", password }) });
      const result = await response.json() as { employee?: Employee; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Не удалось добавить сотрудника");
      upsertEmployee(result.employee);
      setName(""); setIdentity(""); setPassword("");
      toast.success("Сотрудник добавлен и может войти в систему");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить сотрудника");
    } finally {
      setSubmitting(false);
    }
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Удалить сотрудника «${employee.name}» и немедленно закрыть ему доступ?`)) return;
    setDeletingId(employee.id);
    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employee.id)}`, { method: "DELETE" });
      const result = await response.json() as { employee?: Employee; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Не удалось удалить сотрудника");
      upsertEmployee(result.employee);
      toast.success("Доступ сотрудника отозван, активные сессии завершены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить сотрудника");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Сотрудники" description="Учётные записи и доступ к рабочему пространству" size="sm">
      <div className="modal-content team-content">
        {canManage ? <div className="employee-form">
          <label className="field"><span>Имя</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Анна Смирнова" autoFocus /></label>
          <label className="field"><span>Email или логин</span><input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="anna@company.ru или anna" autoComplete="off" /></label>
          <label className="field"><span>Временный пароль</span><div className="password-field"><KeyRound size={14} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} placeholder="Минимум 10 символов" autoComplete="new-password" /></div></label>
          <button className="button primary" onClick={() => void submit()} disabled={submitting}><UserPlus size={15} />{submitting ? "Добавляем…" : "Добавить сотрудника"}</button>
        </div> : <div className="team-readonly-note"><ShieldCheck size={16} /><span>Создавать и удалять учётные записи может только администратор.</span></div>}
        <div className="employee-section-title"><UsersRound size={15} /><span>Команда</span><b>{activeCount}</b></div>
        <div className="employee-list">
          {employeeList.map((employee) => (
            <div className={cn("employee-row", employee.status === "deleted" && "deleted")} key={employee.id}>
              <span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span>
              <div className="employee-details"><div><strong>{employee.name}</strong><span className={cn("employee-status", employee.status)}>{employee.status === "active" ? "Активен" : "Удалён"}</span></div><span>{employee.email ? <Mail size={11} /> : <KeyRound size={11} />}{employee.email || employee.login}</span></div>
              {canManage && employee.status === "active" && employee.id !== currentUserId && employee.role !== "admin" && <button className="icon-button small employee-delete" onClick={() => void removeEmployee(employee)} disabled={deletingId === employee.id} aria-label={`Удалить сотрудника ${employee.name}`}><Trash2 size={14} /></button>}
            </div>
          ))}
          {employeeList.length === 0 && <div className="employee-empty">Добавьте первого сотрудника</div>}
        </div>
      </div>
      <footer className="modal-actions"><span /><button className="button secondary" onClick={onClose}>Готово</button></footer>
    </Modal>
  );
}
