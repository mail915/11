import { prisma } from "../db";

export async function requireTeamMember(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function requireProjectMember(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function requireProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { project: null, membership: null };
  const membership = await requireProjectMember(projectId, userId);
  return { project, membership };
}

export function canManageProject(role: string | undefined) {
  return role === "OWNER" || role === "ADMIN";
}
