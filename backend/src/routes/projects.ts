import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireTeamMember, requireProjectAccess, canManageProject } from "../utils/access";
import { notify } from "../utils/notify";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.userId },
    include: { project: true },
  });
  res.json(memberships.map((m) => ({ ...m.project, myRole: m.role })));
});

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  teamId: z.string().uuid(),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const membership = await requireTeamMember(parsed.data.teamId, req.userId!);
  if (!membership) return res.status(403).json({ error: "Not a member of this team" });

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      members: { create: { userId: req.userId!, role: "OWNER" } },
    },
  });
  res.status(201).json(project);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  res.json({ ...project, myRole: membership.role });
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  if (!canManageProject(membership.role)) return res.status(403).json({ error: "Requires OWNER or ADMIN role" });

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.project.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  if (membership.role !== "OWNER") return res.status(403).json({ error: "Requires OWNER role" });

  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get("/:id/members", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });

  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(members);
});

const addProjectMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
});

router.post("/:id/members", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  if (!canManageProject(membership.role)) return res.status(403).json({ error: "Requires OWNER or ADMIN role" });

  const parsed = addProjectMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: "No user with that email" });

  const teamMembership = await requireTeamMember(project.teamId, user.id);
  if (!teamMembership) {
    return res.status(400).json({ error: "User must be a member of the project's team first" });
  }

  const existing = await requireProjectAccess(req.params.id, user.id);
  if (existing.membership) return res.status(409).json({ error: "User is already a project member" });

  const newMember = await prisma.projectMember.create({
    data: { projectId: req.params.id, userId: user.id, role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await notify(user.id, "ADDED_TO_PROJECT", `You were added to project "${project.name}"`, "project", project.id);

  res.status(201).json(newMember);
});

const updateMemberRoleSchema = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) });

router.patch("/:id/members/:userId", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  if (membership.role !== "OWNER") return res.status(403).json({ error: "Requires OWNER role" });

  const parsed = updateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
  });
  if (!target) return res.status(404).json({ error: "Member not found" });

  if (target.role === "OWNER" && parsed.data.role !== "OWNER") {
    const ownerCount = await prisma.projectMember.count({ where: { projectId: req.params.id, role: "OWNER" } });
    if (ownerCount <= 1) return res.status(400).json({ error: "Project must keep at least one OWNER" });
  }

  const updated = await prisma.projectMember.update({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    data: { role: parsed.data.role },
  });
  res.json(updated);
});

router.delete("/:id/members/:userId", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });
  if (!canManageProject(membership.role)) return res.status(403).json({ error: "Requires OWNER or ADMIN role" });

  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
  });
  if (!target) return res.status(404).json({ error: "Member not found" });

  if (target.role === "OWNER") {
    const ownerCount = await prisma.projectMember.count({ where: { projectId: req.params.id, role: "OWNER" } });
    if (ownerCount <= 1) return res.status(400).json({ error: "Project must keep at least one OWNER" });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
  });
  res.status(204).send();
});

export default router;
