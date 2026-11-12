import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin-nav";
import { LogoutButton } from "@/components/logout-button";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin-shell">
      <div className="app-window">
        <aside className="admin-sidebar">
          <div className="sidebar-top">
            <div className="brand-badge">
              <span className="brand-pulse" />
            </div>
            <div className="brand-copy">
              <div className="eyebrow">Workflow Capture AI</div>
              <h2>Console</h2>
            </div>
          </div>

          <AdminNav />

          <div className="sidebar-footer">
            <div className="tenant-pill">
              <span className="tenant-avatar">A</span>
              <span>Acme Corp</span>
            </div>
            <LogoutButton />
          </div>
        </aside>

        <main className="workspace-shell">
          <div className="window-chrome">
            <span className="chrome-dot red" />
            <span className="chrome-dot yellow" />
            <span className="chrome-dot green" />
          </div>
          <div className="workspace-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
