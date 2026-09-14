import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireTeamMember } from "../utils/access";
import { notify } from "../utils/notify";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId: req.userId },
    include: { team: true },
  });
  res.json(memberships.map((m) => ({ ...m.team, role: m.role })));
});

const createTeamSchema = z.object({ name: z.string().min(1) });

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId: req.userId!, role: "OWNER" } },
    },
  });
  res.status(201).json(team);
});

router.get("/:id/members", async (req: AuthedRequest, res) => {
  const membership = await requireTeamMember(req.params.id, req.userId!);
  if (!membership) return res.status(403).json({ error: "Not a member of this team" });

  const members = await prisma.teamMember.findMany({
    where: { teamId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(members);
});

const addMemberSchema = z.object({ email: z.string().email() });

router.post("/:id/members", async (req: AuthedRequest, res) => {
  const membership = await requireTeamMember(req.params.id, req.userId!);
  if (!membership) return res.status(403).json({ error: "Not a member of this team" });

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: "No user with that email" });

  const existing = await requireTeamMember(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: "User already in team" });

  const newMember = await prisma.teamMember.create({
    data: { teamId: req.params.id, userId: user.id, role: "MEMBER" },
  });

  const team = await prisma.team.findUnique({ where: { id: req.params.id } });
  await notify(user.id, "ADDED_TO_TEAM", `You were added to team "${team?.name}"`, "team", req.params.id);

  res.status(201).json(newMember);
});

export default router;
