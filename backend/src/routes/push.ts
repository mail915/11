import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    update: { userId: req.userId!, platform: parsed.data.platform },
    create: { userId: req.userId!, token: parsed.data.token, platform: parsed.data.platform },
  });

  res.status(204).send();
});

router.delete("/", async (req: AuthedRequest, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : undefined;
  if (!token) return res.status(400).json({ error: "token is required" });

  await prisma.pushToken.deleteMany({ where: { token, userId: req.userId } });
  res.status(204).send();
});

export default router;
