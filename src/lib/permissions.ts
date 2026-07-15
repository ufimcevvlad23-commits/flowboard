import type { EmployeeRole, SessionUser } from "@/types/board";

export const roleLabels: Record<EmployeeRole, string> = {
  admin: "Администратор",
  member: "Пользователь",
  guest: "Гость",
};

export function getAccess(user: Pick<SessionUser, "role" | "canEditDeadlines">) {
  const isAdmin = user.role === "admin";
  const canEditWorkspace = user.role !== "guest";
  return {
    isAdmin,
    canManageEmployees: isAdmin,
    canEditWorkspace,
    canEditDeadlines: isAdmin || (canEditWorkspace && user.canEditDeadlines),
  };
}
