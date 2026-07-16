"use client";

import { useState } from "react";
import { CalendarClock, Check, Eye, KeyRound, Mail, Pencil, ShieldCheck, Trash2, UserCog, UserPlus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select-menu";
import { roleLabels } from "@/lib/permissions";
import { cn, employeeColor, employeeInitials } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";
import type { Employee, EmployeeRole } from "@/types/board";

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  currentUserId: string;
}

const roleDescriptions: Record<EmployeeRole, string> = {
  admin: "Полный доступ ко всем данным и настройкам",
  member: "Работа с досками и задачами без управления сотрудниками",
  guest: "Только просмотр существующих задач",
};

export function TeamDialog({ open, onClose, canManage, currentUserId }: TeamDialogProps) {
  const employees = useBoardStore((state) => state.employees);
  const upsertEmployee = useBoardStore((state) => state.upsertEmployee);
  const [tab, setTab] = useState<"employees" | "access">("employees");
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("member");
  const [canEditDeadlines, setCanEditDeadlines] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIdentity, setEditIdentity] = useState("");
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const employeeList = Object.values(employees).sort((a, b) => a.status === b.status ? a.name.localeCompare(b.name, "ru") : a.status === "active" ? -1 : 1);
  const activeEmployees = employeeList.filter((employee) => employee.status === "active");

  const submit = async () => {
    if (!name.trim()) { toast.error("Введите имя сотрудника"); return; }
    if (!identity.trim()) { toast.error("Введите email или логин"); return; }
    if (password.length < 10 || !/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) { toast.error("Пароль: минимум 10 символов, буква и цифра"); return; }
    setSubmitting(true);
    try {
      const login = identity.trim().toLocaleLowerCase("ru");
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), login, email: login.includes("@") ? login : "", password, role, canEditDeadlines }),
      });
      const result = await response.json() as { employee?: Employee; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Не удалось добавить сотрудника");
      upsertEmployee(result.employee);
      setName(""); setIdentity(""); setPassword(""); setRole("member"); setCanEditDeadlines(true);
      toast.success("Сотрудник добавлен с выбранными правами");
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

  const updateAccess = async (employee: Employee, nextRole: EmployeeRole, deadlineAccess: boolean) => {
    setSavingAccessId(employee.id);
    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole, canEditDeadlines: deadlineAccess }),
      });
      const result = await response.json() as { employee?: Employee; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Не удалось обновить права");
      upsertEmployee(result.employee);
      toast.success(`Права сотрудника «${employee.name}» обновлены`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить права");
    } finally {
      setSavingAccessId(null);
    }
  };

  const startEditing = (employee: Employee) => {
    setEditingId(employee.id);
    setEditName(employee.name);
    setEditIdentity(employee.email || employee.login);
  };

  const saveEmployee = async (employee: Employee) => {
    if (!editName.trim()) { toast.error("Введите имя сотрудника"); return; }
    if (!editIdentity.trim()) { toast.error("Введите email или логин"); return; }
    setSavingEmployeeId(employee.id);
    try {
      const login = editIdentity.trim().toLocaleLowerCase("ru");
      const response = await fetch(`/api/employees/${encodeURIComponent(employee.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), login, email: login.includes("@") ? login : "" }),
      });
      const result = await response.json() as { employee?: Employee; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Не удалось обновить сотрудника");
      upsertEmployee(result.employee);
      setEditingId(null);
      toast.success(`Данные сотрудника «${result.employee.name}» обновлены`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить сотрудника");
    } finally {
      setSavingEmployeeId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Сотрудники" description="Учётные записи и доступ к рабочему пространству" size="sm">
      {canManage && <div className="team-tabs" role="tablist" aria-label="Управление сотрудниками">
        <button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")} role="tab" aria-selected={tab === "employees"}><UsersRound size={15} />Сотрудники</button>
        <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")} role="tab" aria-selected={tab === "access"}><UserCog size={15} />Права доступа</button>
      </div>}
      <div className="modal-content team-content">
        {tab === "employees" ? <>
          {canManage ? <div className="employee-form">
            <label className="field"><span>Имя</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Анна Смирнова" autoFocus /></label>
            <label className="field"><span>Email или логин</span><input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="anna@company.ru или anna" autoComplete="off" /></label>
            <label className="field"><span>Временный пароль</span><div className="password-field"><KeyRound size={14} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} placeholder="Минимум 10 символов" autoComplete="new-password" /></div></label>
            <div className="field"><span>Уровень доступа</span><SelectMenu value={role} ariaLabel="Уровень доступа" options={(Object.keys(roleLabels) as EmployeeRole[]).map((value) => ({ value, label: roleLabels[value], description: roleDescriptions[value] }))} onChange={(value) => { const nextRole = value as EmployeeRole; setRole(nextRole); setCanEditDeadlines(nextRole !== "guest"); }} /><small className="field-help">{roleDescriptions[role]}</small></div>
            {role === "member" && <label className="permission-toggle"><input type="checkbox" checked={canEditDeadlines} onChange={(event) => setCanEditDeadlines(event.target.checked)} /><span><CalendarClock size={15} /><b>Изменение дедлайнов</b><small>Разрешить менять сроки задач и пунктов чек-листа</small></span></label>}
            <button className="button primary" onClick={() => void submit()} disabled={submitting}><UserPlus size={15} />{submitting ? "Добавляем…" : "Добавить сотрудника"}</button>
          </div> : <div className="team-readonly-note"><ShieldCheck size={16} /><span>Создавать, удалять сотрудников и выдавать права может только администратор.</span></div>}
          <div className="employee-section-title"><UsersRound size={15} /><span>Команда</span><b>{activeEmployees.length}</b></div>
          <div className="employee-list">
            {employeeList.map((employee) => (
              <div className={cn("employee-row", employee.status === "deleted" && "deleted")} key={employee.id}>
                <span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span>
                {editingId === employee.id ? <div className="employee-edit-fields">
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Имя сотрудника" aria-label="Имя сотрудника" autoFocus />
                  <input value={editIdentity} onChange={(event) => setEditIdentity(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void saveEmployee(employee)} placeholder="Email или логин" aria-label="Email или логин сотрудника" />
                </div> : <div className="employee-details"><div><strong>{employee.name}</strong><span className={cn("employee-status", employee.status)}>{employee.status === "active" ? "Активен" : "Удалён"}</span></div><span>{employee.email ? <Mail size={11} /> : <KeyRound size={11} />}{employee.email || employee.login}</span><small className={`role-badge role-${employee.role}`}>{roleLabels[employee.role]}</small></div>}
                {canManage && employee.status === "active" && <div className="employee-actions">
                  {editingId === employee.id ? <>
                    <button className="icon-button small employee-save" onClick={() => void saveEmployee(employee)} disabled={savingEmployeeId === employee.id} aria-label={`Сохранить данные сотрудника ${employee.name}`}><Check size={14} /></button>
                    <button className="icon-button small" onClick={() => setEditingId(null)} disabled={savingEmployeeId === employee.id} aria-label="Отменить редактирование"><X size={14} /></button>
                  </> : <button className="icon-button small" onClick={() => startEditing(employee)} aria-label={`Редактировать сотрудника ${employee.name}`}><Pencil size={14} /></button>}
                  {employee.id !== currentUserId && employee.role !== "admin" && editingId !== employee.id && <button className="icon-button small employee-delete" onClick={() => void removeEmployee(employee)} disabled={deletingId === employee.id} aria-label={`Удалить сотрудника ${employee.name}`}><Trash2 size={14} /></button>}
                </div>}
              </div>
            ))}
            {employeeList.length === 0 && <div className="employee-empty">Добавьте первого сотрудника</div>}
          </div>
        </> : <>
          <div className="access-intro"><ShieldCheck size={17} /><div><strong>Роли и ограничения</strong><span>Изменения применяются к активным сессиям сотрудника сразу.</span></div></div>
          <div className="access-list">
            {activeEmployees.map((employee) => {
              const locked = employee.id === currentUserId;
              const saving = savingAccessId === employee.id;
              return <div className="access-row" key={employee.id}>
                <div className="access-identity"><span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span><div><strong>{employee.name}</strong><small>{locked ? "Текущий администратор" : employee.email || employee.login}</small></div></div>
                <div className="access-role"><span>Роль</span><SelectMenu compact value={employee.role} disabled={locked || saving} ariaLabel={`Роль сотрудника ${employee.name}`} options={(Object.keys(roleLabels) as EmployeeRole[]).map((value) => ({ value, label: roleLabels[value] }))} onChange={(value) => { const nextRole = value as EmployeeRole; void updateAccess(employee, nextRole, nextRole === "admin" ? true : nextRole === "guest" ? false : employee.canEditDeadlines); }} /></div>
                <label className={cn("permission-toggle compact-permission", employee.role !== "member" && "forced")}><input type="checkbox" checked={employee.role === "admin" || (employee.role === "member" && employee.canEditDeadlines)} disabled={locked || saving || employee.role !== "member"} onChange={(event) => void updateAccess(employee, employee.role, event.target.checked)} /><span><CalendarClock size={14} /><b>Изменение дедлайнов</b><small>{employee.role === "admin" ? "Всегда разрешено администратору" : employee.role === "guest" ? "Недоступно гостю" : employee.canEditDeadlines ? "Разрешено" : "Запрещено"}</small></span></label>
                <div className="access-summary">{employee.role === "guest" ? <Eye size={14} /> : <ShieldCheck size={14} />}<span>{roleDescriptions[employee.role]}</span></div>
              </div>;
            })}
          </div>
        </>}
      </div>
      <footer className="modal-actions"><span /><button className="button secondary" onClick={onClose}>Готово</button></footer>
    </Modal>
  );
}
