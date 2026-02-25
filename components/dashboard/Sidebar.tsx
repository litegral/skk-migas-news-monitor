"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  RiDashboardLine,
  RiSettings3Line,
  RiOilLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiCloseLine,
  RiFireLine,
  RiSideBarLine,
  RiSideBarFill,
} from "@remixicon/react";

import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import { cx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: RiDashboardLine },
  { name: "Settings", href: "/settings", icon: RiSettings3Line },
] as const;

export function Sidebar({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname();
  const { collapse } = useSidebar();

  return (
    <nav className={cx("flex flex-col", className)}>
      {/* Logo + collapse button */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="flex shrink-0 items-center justify-center bg-transparent">
            <Image src="/kalsul_logo.jpeg" alt="Logo" width={48} height={48} className="object-contain" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            SKK Migas Kalsul
          </span>
        </div>
        <button
          type="button"
          onClick={collapse}
          className="hidden rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:block dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
          aria-label="Collapse sidebar"
        >
          <RiSideBarLine className="size-5" />
        </button>
      </div>

      {/* Nav links */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50",
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="border-t border-gray-200 px-3 py-4 dark:border-gray-800">
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
      className="w-full justify-start gap-3 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
      onClick={handleSignOut}
      disabled={isLoading}
    >
      <RiLogoutBoxRLine className="size-5 shrink-0" aria-hidden="true" />
      {isLoading ? "Keluar..." : "Sign out"}
    </Button>
  );
}

export function MobileHeader() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-2.5">
          <div className="flex shrink-0 items-center justify-center bg-transparent">
            <Image src="/kalsul_logo.jpeg" alt="Logo" width={40} height={40} className="object-contain" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            SKK Migas Kalsul
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
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
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white lg:hidden dark:bg-gray-950">
            <Sidebar className="h-full" />
          </div>
        </>
      )}
    </>
  );
}

/** Floating button to expand sidebar when it's collapsed (desktop only) */
export function SidebarExpandButton() {
  const { isCollapsed, expand } = useSidebar();

  if (!isCollapsed) return null;

  return (
    <button
      type="button"
      onClick={expand}
      className="fixed left-4 top-4 z-40 hidden rounded-md border border-gray-200 bg-white p-2 shadow-md transition-colors hover:bg-gray-50 lg:block dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
      aria-label="Expand sidebar"
    >
      <RiSideBarFill className="size-5 text-gray-600 dark:text-gray-400" />
    </button>
  );
}
