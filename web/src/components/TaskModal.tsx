import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { api, Attachment, Comment, Task, TaskPriority } from "../api/client";

interface Props {
  taskId: string;
  members: { id: string; name: string; email: string }[];
  onClose: () => void;
  onChanged: () => void;
}

export default function TaskModal({ taskId, members, onClose, onChanged }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [t, c, a] = await Promise.all([
      api.get<Task>(`/tasks/${taskId}`),
      api.get<Comment[]>(`/tasks/${taskId}/comments`),
      api.get<Attachment[]>(`/tasks/${taskId}/attachments`),
    ]);
    setTask(t);
    setDescription(t.description ?? "");
    setComments(c);
    setAttachments(a);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function update(fields: Partial<Pick<Task, "priority" | "assigneeId" | "startDate" | "dueDate">>) {
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

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.upload(`/tasks/${taskId}/attachments`, file);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    if (!confirm("Удалить файл?")) return;
    await api.del(`/attachments/${id}`);
    load();
  }

  async function remove() {
    if (!confirm("Удалить задачу?")) return;
    await api.del(`/tasks/${taskId}`);
    onChanged();
    onClose();
  }

  if (!task) return null;

  const delegatedFromMember = task.delegatedById ? members.find((m) => m.id === task.delegatedById) : undefined;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task.title}</h3>
          <button className="link-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {task.delegatedById && (
          <div className="delegation-banner">
            ↪ Делегировано{delegatedFromMember ? ` от ${delegatedFromMember.name}` : ""}
          </div>
        )}

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
            Исполнитель {task.assigneeId ? "(смена = делегирование)" : ""}
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
        </div>

        <div className="field-row">
          <label>
            Начало
            <input
              type="date"
              value={task.startDate ? task.startDate.slice(0, 10) : ""}
              onChange={(e) =>
                update({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
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

        <div className="attachments-section">
          <h4>Вложения</h4>
          {attachments.length === 0 && <p className="muted small">Пока нет файлов</p>}
          {attachments.map((a) => (
            <div key={a.id} className="attachment-row">
              <a href={a.url} target="_blank" rel="noreferrer">
                📎 {a.originalName}
              </a>
              <span className="muted small">{formatSize(a.size)}</span>
              <button className="link-button" onClick={() => removeAttachment(a.id)}>
                Удалить
              </button>
            </div>
          ))}
          <label className="file-upload-label">
            {uploading ? "Загрузка…" : "+ Прикрепить файл"}
            <input type="file" onChange={onPickFile} disabled={uploading} hidden />
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
