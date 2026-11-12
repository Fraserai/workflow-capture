"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/captures", label: "Captures", icon: "captures" },
  { href: "/app/datasets", label: "Datasets", icon: "datasets" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

function Icon({ kind }: { kind: string }) {
  if (kind === "datasets") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6.5" rx="6.5" ry="3.5" />
        <path d="M5.5 6.5v5c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-5" />
        <path d="M5.5 11.5v5c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-5" />
      </svg>
    );
  }

  if (kind === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 2.75v2.2M12 19.05v2.2M4.95 4.95l1.55 1.55M17.5 17.5l1.55 1.55M2.75 12h2.2M19.05 12h2.2M4.95 19.05l1.55-1.55M17.5 6.5l1.55-1.55" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <path d="M20 9.5l3 2v3l-3 2z" />
    </svg>
  );
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={active ? "admin-link active" : "admin-link"}>
            <span className="admin-link-icon">
              <Icon kind={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
