import { NotificationType } from "@prisma/client";
import { prisma } from "../db";
import { sendExpoPush } from "./push";

export async function notify(
  userId: string,
  type: NotificationType,
  message: string,
  entityType: string,
  entityId: string
) {
  await prisma.notification.create({
    data: { userId, type, message, entityType, entityId },
  });

  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (tokens.length > 0) {
    await sendExpoPush(tokens.map((t) => t.token), "TaskFlow", message, { entityType, entityId });
  }
}
