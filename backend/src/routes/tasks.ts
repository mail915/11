import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireProjectAccess, requireProjectMember, canManageProject } from "../utils/access";
import { notify } from "../utils/notify";

const router = Router();
router.use(requireAuth);

async function taskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return { task: null, membership: null };
  const membership = await requireProjectMember(task.projectId, userId);
  return { task, membership };
}

router.get("/projects/:projectId/tasks", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.projectId, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });

  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(tasks);
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
});

router.post("/projects/:projectId/tasks", async (req: AuthedRequest, res) => {
  const { project, membership } = await requireProjectAccess(req.params.projectId, req.userId!);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this project" });

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.assigneeId) {
    const assigneeMembership = await requireProjectMember(req.params.projectId, parsed.data.assigneeId);
    if (!assigneeMembership) {
      return res.status(400).json({ error: "Assignee is not a member of this project" });
    }
  }

  const task = await prisma.task.create({
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      projectId: req.params.projectId,
      createdById: req.userId!,
    },
  });

  if (task.assigneeId && task.assigneeId !== req.userId) {
    await notify(task.assigneeId, "TASK_ASSIGNED", `You were assigned to "${task.title}"`, "task", task.id);
  }

  res.status(201).json(task);
});

router.get("/tasks/:id", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.id, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });
  res.json(task);
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

router.patch("/tasks/:id", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.id, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.assigneeId) {
    const assigneeMembership = await requireProjectMember(task.projectId, parsed.data.assigneeId);
    if (!assigneeMembership) {
      return res.status(400).json({ error: "Assignee is not a member of this project" });
    }
  }

  const assigneeChanging = parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== task.assigneeId;
  const isDelegation = assigneeChanging && !!task.assigneeId && !!parsed.data.assigneeId;

  const updated = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      startDate:
        parsed.data.startDate === undefined ? undefined : parsed.data.startDate === null ? null : new Date(parsed.data.startDate),
      dueDate:
        parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate === null ? null : new Date(parsed.data.dueDate),
      delegatedById: assigneeChanging ? (isDelegation ? req.userId : null) : undefined,
    },
  });

  if (assigneeChanging && parsed.data.assigneeId && parsed.data.assigneeId !== req.userId) {
    if (isDelegation) {
      await notify(
        parsed.data.assigneeId,
        "TASK_DELEGATED",
        `"${updated.title}" was delegated to you`,
        "task",
        updated.id
      );
    } else {
      await notify(parsed.data.assigneeId, "TASK_ASSIGNED", `You were assigned to "${updated.title}"`, "task", updated.id);
    }
  }

  if (parsed.data.status && parsed.data.status !== task.status && task.assigneeId && task.assigneeId !== req.userId) {
    await notify(
      task.assigneeId,
      "TASK_STATUS_CHANGED",
      `"${updated.title}" status changed to ${updated.status}`,
      "task",
      updated.id
    );
  }

  res.json(updated);
});

router.delete("/tasks/:id", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.id, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });
  if (!canManageProject(membership.role) && task.createdById !== req.userId) {
    return res.status(403).json({ error: "Only the task creator or an OWNER/ADMIN can delete this task" });
  }

  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
