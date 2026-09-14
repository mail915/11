import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireProjectMember } from "../utils/access";
import { notify } from "../utils/notify";

const router = Router();
router.use(requireAuth);

async function taskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { task: null, membership: null };
  const membership = await requireProjectMember(task.projectId, userId);
  return { task, membership };
}

router.get("/tasks/:taskId/comments", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.taskId, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });

  const comments = await prisma.comment.findMany({
    where: { taskId: req.params.taskId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

const createCommentSchema = z.object({ body: z.string().min(1) });

router.post("/tasks/:taskId/comments", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.taskId, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const comment = await prisma.comment.create({
    data: { body: parsed.data.body, taskId: req.params.taskId, authorId: req.userId! },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  const notifyUserIds = new Set(
    [task.assigneeId, task.createdById].filter((id): id is string => !!id && id !== req.userId)
  );
  await Promise.all(
    [...notifyUserIds].map((userId) =>
      notify(userId, "NEW_COMMENT", `New comment on "${task.title}"`, "task", task.id)
    )
  );

  res.status(201).json(comment);
});

export default router;
