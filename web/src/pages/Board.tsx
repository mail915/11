import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Project, ProjectMember, Task, TaskStatus } from "../api/client";
import TaskModal from "../components/TaskModal";
import ProjectMembers from "../components/ProjectMembers";
import GanttChart from "../components/GanttChart";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "К выполнению" },
  { status: "IN_PROGRESS", label: "В работе" },
  { status: "DONE", label: "Готово" },
];

type View = "board" | "gantt";

export default function Board() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const proj = await api.get<Project>(`/projects/${projectId}`);
      setProject(proj);
      const [taskList, memberList] = await Promise.all([
        api.get<Task[]>(`/projects/${projectId}/tasks`),
        api.get<ProjectMember[]>(`/projects/${projectId}/members`),
      ]);
      setTasks(taskList);
      setMembers(memberList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !projectId) return;
    await api.post(`/projects/${projectId}/tasks`, { title: newTitle.trim() });
    setNewTitle("");
    load();
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await api.patch(`/tasks/${taskId}`, { status });
    load();
  }

  if (loading || !project) return <div className="center-screen">Загрузка…</div>;

  return (
    <div className="page">
      <div className="board-header">
        <h2>{project.name}</h2>
        <div className="view-switch">
          <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
            Канбан
          </button>
          <button className={view === "gantt" ? "active" : ""} onClick={() => setView("gantt")}>
            Гант
          </button>
          <button className="link-button" onClick={() => setShowMembers((v) => !v)}>
            {showMembers ? "Скрыть участников" : "Участники проекта"}
          </button>
        </div>
        {view === "board" && (
          <form onSubmit={createTask} className="inline-form">
            <input
              placeholder="Новая задача…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit">Добавить</button>
          </form>
        )}
      </div>

      {showMembers && (
        <ProjectMembers projectId={project.id} members={members} myRole={project.myRole} onChanged={load} />
      )}

      {view === "board" ? (
        <div className="board">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              className="board-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const taskId = e.dataTransfer.getData("text/task-id");
                if (taskId) moveTask(taskId, col.status);
              }}
            >
              <h3>{col.label}</h3>
              {tasks
                .filter((t) => t.status === col.status)
                .map((t) => (
                  <div
                    key={t.id}
                    className={`task-card priority-${t.priority.toLowerCase()}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    <strong>{t.title}</strong>
                    {t.assignee && <div className="muted small">👤 {t.assignee.name}</div>}
                    {t.delegatedById && <div className="muted small">↪ делегировано</div>}
                    {t.dueDate && (
                      <div className="muted small">📅 {new Date(t.dueDate).toLocaleDateString("ru-RU")}</div>
                    )}
                    <div className="column-switch">
                      {COLUMNS.filter((c) => c.status !== t.status).map((c) => (
                        <button
                          key={c.status}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTask(t.id, c.status);
                          }}
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <GanttChart tasks={tasks} />
        </div>
      )}

      {activeTaskId && (
        <TaskModal
          taskId={activeTaskId}
          members={members.map((m) => m.user)}
          onClose={() => setActiveTaskId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
