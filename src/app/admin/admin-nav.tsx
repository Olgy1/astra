"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";

const SECTIONS = [
  { href: "/admin", label: "Tableau de bord", icon: "dashboard" },
  { href: "/admin/users", label: "Utilisateurs", icon: "users" },
  { href: "/admin/biolinks", label: "Pages", icon: "link" },
  { href: "/admin/reports", label: "Modération", icon: "flag" },
  { href: "/admin/slugs", label: "Slugs", icon: "tag" },
  { href: "/admin/logs", label: "Journal", icon: "scroll" },
  { href: "/admin/emails", label: "Emails", icon: "mail" },
] as const;

type IconName = (typeof SECTIONS)[number]["icon"];

/** Icônes de la navigation, en trait fin pour rester discrètes. */
function NavIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.4 2.4 0 0 0 3.42 0l6.58-6.58a2.4 2.4 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
      );
    case "scroll":
      return (
        <svg {...common}>
          <path d="M19 17V5a2 2 0 0 0-2-2H4" />
          <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      );
  }
}

export function AdminNav({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border-subtle bg-surface-1/60 p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-muted text-accent">
            <Logo className="size-5" />
          </span>
          <span className="text-sm font-semibold">Administration</span>
        </Link>

        <nav className="mt-6 flex flex-col gap-1">
          {SECTIONS.map((section) => {
            const active =
              section.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(section.href);

            return (
              <Link
                key={section.href}
                href={section.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent-muted font-medium text-accent"
                    : "text-content-secondary hover:bg-surface-2 hover:text-content-primary"
                }`}
              >
                <span className="flex w-5 shrink-0 items-center justify-center">
                  <NavIcon name={section.icon} className="size-4" />
                </span>
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border-subtle pt-4">
          <p className="px-2 text-xs text-content-muted">Connecté en tant que</p>
          <p className="mt-0.5 px-2 text-sm font-medium">{username}</p>
          <Link
            href="/panel"
            className="mt-3 block rounded-lg px-2 py-1.5 text-xs text-content-muted transition-colors hover:bg-surface-2 hover:text-content-primary"
          >
            ← Retour au panel
          </Link>
        </div>
      </aside>

      {/* Barre d'onglets mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur lg:hidden">
        <div className="flex overflow-x-auto">
          {SECTIONS.map((section) => {
            const active =
              section.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(section.href);

            return (
              <Link
                key={section.href}
                href={section.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] transition-colors ${
                  active ? "text-accent" : "text-content-muted"
                }`}
              >
                <NavIcon name={section.icon} className="size-5" />
                {section.label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
