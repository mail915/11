import { useEffect, useRef, useState } from "react";
import { api, Notification } from "../api/client";

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await api.get<Notification[]>("/notifications");
      setNotifications(data);
    } catch {
      // ignore transient errors
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    load();
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  return (
    <div className="notifications-bell" ref={ref}>
      <button className="bell-button" onClick={() => setOpen((v) => !v)}>
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notifications-dropdown">
          <div className="notifications-dropdown-header">
            <strong>Уведомления</strong>
            {unreadCount > 0 && (
              <button className="link-button" onClick={markAllRead}>
                Прочитать все
              </button>
            )}
          </div>
          {notifications.length === 0 && <p className="muted">Нет уведомлений</p>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item ${n.read ? "" : "unread"}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div>{n.message}</div>
              <small className="muted">{new Date(n.createdAt).toLocaleString("ru-RU")}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
