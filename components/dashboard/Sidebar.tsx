"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  RiDashboardLine,
  RiSettings3Line,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiCloseLine,
  RiSideBarLine,
  RiSideBarFill,
  RiHistoryLine,
  RiPulseLine,
} from "@remixicon/react";

import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { cx } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: RiDashboardLine },
  { name: "Pengaturan", href: "/settings", icon: RiSettings3Line },
  { name: "Log Aktivitas", href: "/logs", icon: RiHistoryLine },
] as const;

export function Sidebar({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname();
  const { collapse } = useSidebar();

  return (
    <nav className={cx("flex flex-col", className)}>
      {/* Logo + collapse button */}
      <div className="flex h-[4.5rem] items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
            <Image src="/kalsul_logo.jpeg" alt="SKK Migas Kalsul" width={40} height={40} className="object-contain" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
              SKK Migas Kalsul
            </span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              News Intelligence
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={collapse}
          className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:block dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Collapse sidebar"
        >
          <RiSideBarLine className="size-5" />
        </button>
      </div>

      {/* Nav links */}
      <div className="flex flex-1 flex-col px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          Workspace
        </p>
        <div className="flex flex-col gap-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)] dark:bg-blue-500/10 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white",
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
        </div>

        <div className="mt-auto rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50/60 p-3.5 dark:border-blue-500/15 dark:from-blue-500/10 dark:to-cyan-500/5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-200">
            <RiPulseLine className="size-4" aria-hidden="true" />
            Monitoring aktif
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-blue-700/70 dark:text-blue-200/60">
            Berita dihimpun dan dianalisis dalam satu workspace.
          </p>
        </div>
      </div>

      {/* Sign out */}
      <div className="border-t border-slate-200/80 px-3 py-4 dark:border-slate-800">
        <SignOutButton />
      </div>
    </nav>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-3 text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
      onClick={handleSignOut}
      disabled={isLoading}
    >
      <RiLogoutBoxRLine className="size-5 shrink-0" aria-hidden="true" />
      {isLoading ? "Keluar..." : "Keluar"}
    </Button>
  );
}

export function MobileHeader() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-[#0a111d]/90">
        <div className="flex items-center gap-2.5">
          <div className="flex shrink-0 items-center justify-center bg-transparent">
            <Image src="/kalsul_logo.jpeg" alt="SKK Migas Kalsul" width={40} height={40} className="rounded-lg object-contain" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            SKK Migas Kalsul
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? (
            <RiCloseLine className="size-5" />
          ) : (
            <RiMenuLine className="size-5" />
          )}
        </button>
      </header>

      {/* Mobile slide-out overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] bg-white shadow-2xl lg:hidden dark:bg-[#0a111d]">
            <Sidebar className="h-full" />
          </div>
        </>
      )}
    </>
  );
}

/** Inline desktop control shown beside page titles when the sidebar is collapsed. */
export function SidebarTrigger() {
  const { isCollapsed, expand } = useSidebar();

  if (!isCollapsed) return null;

  return (
    <button
      type="button"
      onClick={expand}
      className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
      aria-label="Expand sidebar"
    >
      <RiSideBarFill className="size-4" />
    </button>
  );
}
