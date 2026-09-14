import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsBell from "./NotificationsBell";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          TaskFlow
        </Link>
        <div className="header-actions">
          <NotificationsBell />
          <span className="muted">{user?.name}</span>
          <button className="link-button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
