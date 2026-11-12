import type { ReactNode } from "react";
import type { Metadata } from "next";

import { TopNav } from "@/components/top-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "workflow-capture-ai dashboard",
  description: "Enterprise workflow capture review, replay, normalization, and export console.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="masthead">
            <div>
              <div className="eyebrow">Workflow Capture AI</div>
              <h1>Operational capture console</h1>
            </div>
            <TopNav />
          </header>
          <main className="page-shell">{children}</main>
        </div>
      </body>
    </html>
  );
}
