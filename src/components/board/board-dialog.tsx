"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { useBoardStore } from "@/store/use-board-store";

interface BoardDialogProps {
  open: boolean;
  boardId: string | null;
  onClose: () => void;
}

const colors = ["#6d5dfc", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#ef4444"];

export function BoardDialog({ open, boardId, onClose }: BoardDialogProps) {
  const board = useBoardStore((state) => boardId ? state.boards[boardId] : undefined);
  const createBoard = useBoardStore((state) => state.createBoard);
  const updateBoard = useBoardStore((state) => state.updateBoard);
  const deleteBoard = useBoardStore((state) => state.deleteBoard);
  const [title, setTitle] = useState(board?.title ?? "");
  const [description, setDescription] = useState(board?.description ?? "");
  const [color, setColor] = useState(board?.color ?? colors[0]);

  const submit = () => {
    if (!title.trim()) { toast.error("Введите название доски"); return; }
    if (boardId) { updateBoard(boardId, { title: title.trim(), description: description.trim(), color }); toast.success("Доска обновлена"); }
    else { createBoard(title.trim(), color, description.trim()); toast.success("Доска создана"); }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={boardId ? "Настройки доски" : "Новая доска"} description={boardId ? "Обновите название и оформление" : "Создайте пространство для нового проекта"} size="sm">
      <div className="modal-content board-form">
        <label className="field"><span>Название</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Запуск продукта" /></label>
        <label className="field"><span>Описание</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Коротко о назначении доски" /></label>
        <div className="field"><span>Акцентный цвет</span><div className="color-picker">{colors.map((item) => <button key={item} className={color === item ? "selected" : ""} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Выбрать цвет ${item}`} />)}</div></div>
      </div>
      <footer className="modal-actions">
        {boardId ? <button className="button ghost danger-text" onClick={() => { if (window.confirm(`Удалить доску «${board?.title}» со всеми данными?`)) { deleteBoard(boardId); toast.success("Доска удалена"); onClose(); } }}><Trash2 size={15} />Удалить</button> : <span />}
        <div><button className="button secondary" onClick={onClose}>Отмена</button><button className="button primary" onClick={submit}>{boardId ? "Сохранить" : "Создать доску"}</button></div>
      </footer>
    </Modal>
  );
}
