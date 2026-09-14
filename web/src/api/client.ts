const TOKEN_KEY = "taskflow_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = data?.error
      ? typeof data.error === "string"
        ? data.error
        : JSON.stringify(data.error)
      : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<T>(path, { method: "POST", body: form });
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
}

export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  teamId: string;
  createdAt: string;
  myRole?: ProjectRole;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  user: { id: string; name: string; email: string };
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  projectId: string;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  delegatedById?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  taskId: string;
  authorId: string;
  author: { id: string; name: string; email: string };
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  uploaderId: string;
  uploader: { id: string; name: string; email: string };
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  entityType: string;
  entityId: string;
  read: boolean;
  createdAt: string;
}
