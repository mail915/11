import { FormEvent, useEffect, useState } from "react";
import { api, Comment, Task, TaskPriority } from "../api/client";

interface Props {
  taskId: string;
  members: { id: string; name: string; email: string }[];
  onClose: () => void;
  onChanged: () => void;
}

export default function TaskModal({ taskId, members, onClose, onChanged }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    const [t, c] = await Promise.all([
      api.get<Task>(`/tasks/${taskId}`),
      api.get<Comment[]>(`/tasks/${taskId}/comments`),
    ]);
    setTask(t);
    setDescription(t.description ?? "");
    setComments(c);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function update(fields: Partial<Pick<Task, "priority" | "assigneeId" | "dueDate">>) {
    await api.patch(`/tasks/${taskId}`, fields);
    load();
    onChanged();
  }

  async function saveDescription() {
    await api.patch(`/tasks/${taskId}`, { description });
    onChanged();
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { body: newComment.trim() });
    setNewComment("");
    load();
  }

  async function remove() {
    if (!confirm("Удалить задачу?")) return;
    await api.del(`/tasks/${taskId}`);
    onChanged();
    onClose();
  }

  if (!task) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task.title}</h3>
          <button className="link-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <label>
          Описание
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={3}
          />
        </label>

        <div className="field-row">
          <label>
            Приоритет
            <select
              value={task.priority}
              onChange={(e) => update({ priority: e.target.value as TaskPriority })}
            >
              <option value="LOW">Низкий</option>
              <option value="MEDIUM">Средний</option>
              <option value="HIGH">Высокий</option>
            </select>
          </label>

          <label>
            Исполнитель
            <select
              value={task.assigneeId ?? ""}
              onChange={(e) => update({ assigneeId: e.target.value || null })}
            >
              <option value="">Не назначен</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Дедлайн
            <input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              onChange={(e) =>
                update({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </label>
        </div>

        <div className="comments-section">
          <h4>Комментарии</h4>
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <strong>{c.author.name}</strong>
              <span className="muted small"> {new Date(c.createdAt).toLocaleString("ru-RU")}</span>
              <p>{c.body}</p>
            </div>
          ))}
          <form onSubmit={submitComment} className="inline-form">
            <input
              placeholder="Написать комментарий…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit">Отправить</button>
          </form>
        </div>

        <button className="danger-button" onClick={remove}>
          Удалить задачу
        </button>
      </div>
    </div>
  );
}
