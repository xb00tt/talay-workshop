"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  CalendarDays,
  BarChart3,
  Settings,
  Users,
  FileText,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/services", labelKey: "services", icon: ClipboardList },
  { href: "/trucks", labelKey: "trucks", icon: Truck },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/reports", labelKey: "reports", icon: BarChart3 },
  { href: "/drivers", labelKey: "drivers", icon: Users },
  { href: "/audit-log", labelKey: "auditLog", icon: FileText },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

function NavLink({
  item,
  onClick,
}: {
  item: NavItem;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const Icon = item.icon;
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        isActive
          ? "bg-[var(--bg-overlay)] text-[var(--text-primary)] font-medium"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {t(item.labelKey as Parameters<typeof t>[0])}
    </Link>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const t = useTranslations("nav");

  return (
    <div className="flex flex-col h-full">
      {/* Logo / brand */}
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">
          Talay Workshop
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavClick} />
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-[var(--border)]">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("settings")}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh bg-[var(--bg-base)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col bg-[var(--bg-surface)] border-r border-[var(--border)]">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">
            Talay Workshop
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent onNavClick={() => setMobileOpen(false)} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 px-4 h-12 bg-[var(--bg-surface)] border-b border-[var(--border)] md:hidden shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide uppercase">
            Talay Workshop
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
