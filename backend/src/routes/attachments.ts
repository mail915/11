import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireProjectMember, canManageProject } from "../utils/access";
import { notify } from "../utils/notify";

const router = Router();
router.use(requireAuth);

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const unique = crypto.randomUUID();
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function taskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { task: null, membership: null };
  const membership = await requireProjectMember(task.projectId, userId);
  return { task, membership };
}

router.get("/tasks/:taskId/attachments", async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.taskId, req.userId!);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });

  const attachments = await prisma.attachment.findMany({
    where: { taskId: req.params.taskId },
    include: { uploader: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(attachments);
});

router.post("/tasks/:taskId/attachments", upload.single("file"), async (req: AuthedRequest, res) => {
  const { task, membership } = await taskAccess(req.params.taskId, req.userId!);
  if (!task) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: "Task not found" });
  }
  if (!membership) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: "Not a member of this task's project" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });

  const attachment = await prisma.attachment.create({
    data: {
      taskId: req.params.taskId,
      uploaderId: req.userId!,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    },
    include: { uploader: { select: { id: true, name: true, email: true } } },
  });

  const notifyUserIds = new Set(
    [task.assigneeId, task.createdById].filter((id): id is string => !!id && id !== req.userId)
  );
  await Promise.all(
    [...notifyUserIds].map((userId) =>
      notify(userId, "NEW_ATTACHMENT", `New attachment on "${task.title}"`, "task", task.id)
    )
  );

  res.status(201).json(attachment);
});

router.delete("/attachments/:id", async (req: AuthedRequest, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!attachment) return res.status(404).json({ error: "Attachment not found" });

  const task = await prisma.task.findUnique({ where: { id: attachment.taskId } });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const membership = await requireProjectMember(task.projectId, req.userId!);
  if (!membership) return res.status(403).json({ error: "Not a member of this task's project" });
  if (attachment.uploaderId !== req.userId && !canManageProject(membership.role)) {
    return res.status(403).json({ error: "Only the uploader or an OWNER/ADMIN can delete this attachment" });
  }

  await prisma.attachment.delete({ where: { id: req.params.id } });
  fs.unlink(path.join(UPLOADS_DIR, attachment.filename), () => {});
  res.status(204).send();
});

export default router;
