import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireTeamMember, requireProjectAccess } from "../utils/access";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const teamIds = (
    await prisma.teamMember.findMany({ where: { userId: req.userId }, select: { teamId: true } })
  ).map((m) => m.teamId);

  const projects = await prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
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

  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json(project);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project's team" });
  res.json(project);
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project's team" });

  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.project.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.id, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project's team" });

  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
