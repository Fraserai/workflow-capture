"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Sessions" },
  { href: "/tasks", label: "Task Traces" },
  { href: "/exports", label: "Exports" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={active ? "top-nav-link active" : "top-nav-link"}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
