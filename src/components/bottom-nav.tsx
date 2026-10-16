"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Treinar", icon: DumbbellIcon },
  { href: "/fichas", label: "Fichas", icon: ListIcon },
  { href: "/evolucao", label: "Evolução", icon: ChartIcon },
  { href: "/perfil", label: "Perfil", icon: UserIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <SvgIcon>
      <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
    </SvgIcon>
  );
}

function ListIcon() {
  return (
    <SvgIcon>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </SvgIcon>
  );
}

function ChartIcon() {
  return (
    <SvgIcon>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </SvgIcon>
  );
}

function UserIcon() {
  return (
    <SvgIcon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </SvgIcon>
  );
}
