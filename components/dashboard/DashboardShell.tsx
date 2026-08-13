"use client";

import React from "react";

import { SidebarProvider, useSidebar } from "@/lib/contexts/SidebarContext";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { AutoFetchProvider } from "@/contexts/AutoFetchContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar, MobileHeader } from "./Sidebar";
import { cx } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}

function DashboardShellInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar -- fixed left, hidden when collapsed */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white/95 transition-transform duration-300 ease-out lg:block dark:border-slate-800 dark:bg-[#0a111d]/95",
          isCollapsed && "-translate-x-full",
        )}
      >
        <Sidebar className="h-full" />
      </aside>

      {/* Mobile header */}
      <MobileHeader />

      {/* Main content area -- expands when sidebar is collapsed */}
      <main
        className={cx(
          "transition-[padding] duration-300 ease-in-out",
          isCollapsed ? "lg:pl-0" : "lg:pl-64",
        )}
      >
        <div className="mx-auto min-w-0 max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 xl:px-10">
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
