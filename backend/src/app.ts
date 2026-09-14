import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth";
import teamRoutes from "./routes/teams";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import commentRoutes from "./routes/comments";
import attachmentRoutes from "./routes/attachments";
import notificationRoutes from "./routes/notifications";
import pushRoutes from "./routes/push";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);
app.use("/api", commentRoutes);
app.use("/api", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push-tokens", pushRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
