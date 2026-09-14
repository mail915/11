import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Project, Team } from "../api/client";

export default function Projects() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (loading) return <div className="center-screen">Загрузка…</div>;

  return (
    <div className="page">
      <section className="panel">
        <h2>Команды</h2>
        {teams.length === 0 && <p className="muted">У вас пока нет команд.</p>}
        <ul className="plain-list">
          {teams.map((t) => (
            <li key={t.id}>
              {t.name} <span className="muted">({t.role === "OWNER" ? "владелец" : "участник"})</span>
            </li>
          ))}
        </ul>
        <form onSubmit={createTeam} className="inline-form">
          <input
            placeholder="Название команды"
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
