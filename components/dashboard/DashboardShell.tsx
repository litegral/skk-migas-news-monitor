"use client";

import React from "react";

import { SidebarProvider, useSidebar } from "@/lib/contexts/SidebarContext";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { AutoFetchProvider } from "@/contexts/AutoFetchContext";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { Sidebar, MobileHeader, SidebarExpandButton } from "./Sidebar";
import { cx } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}

function DashboardShellInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar -- fixed left, hidden when collapsed */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:block dark:border-gray-800 dark:bg-gray-950",
          isCollapsed && "-translate-x-full",
        )}
      >
        <Sidebar className="h-full" />
      </aside>

      {/* Floating expand button when sidebar is collapsed */}
      <SidebarExpandButton />

      {/* Mobile header */}
      <MobileHeader />

      {/* Main content area -- expands when sidebar is collapsed */}
      <main
        className={cx(
          "transition-[padding] duration-300 ease-in-out",
          isCollapsed ? "lg:pl-0" : "lg:pl-60",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function DashboardShell({ children, initialCollapsed = false }: Readonly<DashboardShellProps>) {
  return (
    <SidebarProvider initialCollapsed={initialCollapsed}>
      <TooltipProvider delayDuration={300}>
        <AnalysisProvider>
          <AutoFetchProvider>
            <DashboardShellInner>{children}</DashboardShellInner>
          </AutoFetchProvider>
        </AnalysisProvider>
      </TooltipProvider>
    </SidebarProvider>
  );
}
