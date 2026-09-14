import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, Project, Team } from "../api/client";

interface TeamMemberRow {
  userId: string;
  role: "OWNER" | "MEMBER";
  user: { id: string; name: string; email: string };
}

export default function Projects() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [teamsData, projectsData] = await Promise.all([
        api.get<Team[]>("/teams"),
        api.get<Project[]>("/projects"),
      ]);
      setTeams(teamsData);
      setProjects(projectsData);
      if (!selectedTeamId && teamsData.length > 0) setSelectedTeamId(teamsData[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamMembers(teamId: string) {
    if (!teamId) return;
    setTeamMembers(await api.get<TeamMemberRow[]>(`/teams/${teamId}/members`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTeamId) loadTeamMembers(selectedTeamId);
  }, [selectedTeamId]);

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await api.post("/teams", { name: newTeamName.trim() });
    setNewTeamName("");
    load();
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim() || !selectedTeamId) return;
    await api.post("/projects", { name: newProjectName.trim(), teamId: selectedTeamId });
    setNewProjectName("");
    load();
  }

  async function inviteToTeam(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!inviteEmail.trim() || !selectedTeamId) return;
    try {
      await api.post(`/teams/${selectedTeamId}/members`, { email: inviteEmail.trim() });
      setInviteEmail("");
      loadTeamMembers(selectedTeamId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось добавить сотрудника");
    }
  }

  if (loading) return <div className="center-screen">Загрузка…</div>;

  return (
    <div className="page">
      <section className="panel">
        <h2>Команды (департамент/юнит)</h2>
        {teams.length === 0 && <p className="muted">У вас пока нет команд.</p>}
        {teams.length > 0 && (
          <>
            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} style={{ marginBottom: 10 }}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role === "OWNER" ? "владелец" : "участник"})
                </option>
              ))}
            </select>
            <p className="muted small">Сотрудники команды — кадровый пул, из которого можно добавлять людей в конкретные проекты.</p>
            <ul className="plain-list">
              {teamMembers.map((m) => (
                <li key={m.userId}>
                  {m.user.name} <span className="muted small">{m.user.email}</span>{" "}
                  <span className="muted">({m.role === "OWNER" ? "владелец" : "сотрудник"})</span>
                </li>
              ))}
            </ul>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={inviteToTeam} className="inline-form">
              <input
                type="email"
                placeholder="email сотрудника"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <button type="submit">Добавить в команду</button>
            </form>
          </>
        )}
        <form onSubmit={createTeam} className="inline-form">
          <input
            placeholder="Название новой команды"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button type="submit">Создать команду</button>
        </form>
      </section>

      <section className="panel">
        <h2>Проекты</h2>
        {projects.length === 0 && <p className="muted">Проектов пока нет.</p>}
        <div className="project-grid">
          {projects.map((p) => (
            <Link to={`/projects/${p.id}`} key={p.id} className="project-card">
              <strong>{p.name}</strong>
              {p.description && <p className="muted">{p.description}</p>}
              {p.myRole && <span className="role-tag">{roleLabel(p.myRole)}</span>}
            </Link>
          ))}
        </div>

        {teams.length > 0 && (
          <form onSubmit={createProject} className="inline-form">
            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Название проекта"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <button type="submit">Создать проект</button>
          </form>
        )}
      </section>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "OWNER") return "владелец";
  if (role === "ADMIN") return "админ";
  return "участник";
}
