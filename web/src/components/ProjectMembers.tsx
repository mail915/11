import { FormEvent, useState } from "react";
import { api, ApiError, ProjectMember, ProjectRole } from "../api/client";

interface Props {
  projectId: string;
  members: ProjectMember[];
  myRole: ProjectRole | undefined;
  onChanged: () => void;
}

const ROLE_LABELS: Record<ProjectRole, string> = { OWNER: "Владелец", ADMIN: "Админ", MEMBER: "Участник" };

export default function ProjectMembers({ projectId, members, myRole, onChanged }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    try {
      await api.post(`/projects/${projectId}/members`, { email: email.trim(), role });
      setEmail("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить участника");
    }
  }

  async function changeRole(userId: string, newRole: ProjectRole) {
    setError(null);
    try {
      await api.patch(`/projects/${projectId}/members/${userId}`, { role: newRole });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось изменить роль");
    }
  }

  async function removeMember(userId: string) {
    setError(null);
    if (!confirm("Убрать участника из проекта?")) return;
    try {
      await api.del(`/projects/${projectId}/members/${userId}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось убрать участника");
    }
  }

  return (
    <div className="panel">
      <h3>Участники проекта</h3>
      {error && <div className="error-banner">{error}</div>}
      <ul className="plain-list">
        {members.map((m) => (
          <li key={m.userId} className="member-row">
            <span>
              {m.user.name} <span className="muted small">{m.user.email}</span>
            </span>
            {canManage ? (
              <div className="member-controls">
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value as ProjectRole)}>
                  <option value="OWNER">Владелец</option>
                  <option value="ADMIN">Админ</option>
                  <option value="MEMBER">Участник</option>
                </select>
                <button className="link-button" onClick={() => removeMember(m.userId)}>
                  Убрать
                </button>
              </div>
            ) : (
              <span className="muted">{ROLE_LABELS[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form onSubmit={addMember} className="inline-form">
          <input
            type="email"
            placeholder="email сотрудника (уже в команде)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
            <option value="MEMBER">Участник</option>
            <option value="ADMIN">Админ</option>
            <option value="OWNER">Владелец</option>
          </select>
          <button type="submit">Добавить в проект</button>
        </form>
      )}
    </div>
  );
}
