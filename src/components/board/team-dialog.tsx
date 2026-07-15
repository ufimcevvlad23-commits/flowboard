"use client";

import { useState } from "react";
import { Mail, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { employeeColor, employeeInitials } from "@/lib/utils";
import { useBoardStore } from "@/store/use-board-store";

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TeamDialog({ open, onClose }: TeamDialogProps) {
  const employees = useBoardStore((state) => state.employees);
  const createEmployee = useBoardStore((state) => state.createEmployee);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const employeeList = Object.values(employees).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const submit = () => {
    if (!name.trim()) { toast.error("Введите имя сотрудника"); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { toast.error("Проверьте email сотрудника"); return; }
    createEmployee(name.trim(), email.trim());
    setName("");
    setEmail("");
    toast.success("Сотрудник добавлен");
  };

  return (
    <Modal open={open} onClose={onClose} title="Сотрудники" description="Добавляйте участников и назначайте их ответственными" size="sm">
      <div className="modal-content team-content">
        <div className="employee-form">
          <label className="field"><span>Имя</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Анна Смирнова" autoFocus /></label>
          <label className="field"><span>Email, необязательно</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="anna@company.ru" /></label>
          <button className="button primary" onClick={submit}><UserPlus size={15} />Добавить сотрудника</button>
        </div>
        <div className="employee-section-title"><UsersRound size={15} /><span>Команда</span><b>{employeeList.length}</b></div>
        <div className="employee-list">
          {employeeList.map((employee) => (
            <div className="employee-row" key={employee.id}>
              <span className="employee-avatar" style={{ background: employeeColor(employee.id) }}>{employeeInitials(employee.name)}</span>
              <div><strong>{employee.name}</strong>{employee.email && <span><Mail size={11} />{employee.email}</span>}</div>
            </div>
          ))}
          {employeeList.length === 0 && <div className="employee-empty">Добавьте первого сотрудника</div>}
        </div>
      </div>
      <footer className="modal-actions"><span /><button className="button secondary" onClick={onClose}>Готово</button></footer>
    </Modal>
  );
}
