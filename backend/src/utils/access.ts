import { prisma } from "../db";

export async function requireTeamMember(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function requireProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { project: null, membership: null };
  const membership = await requireTeamMember(project.teamId, userId);
  return { project, membership };
}
