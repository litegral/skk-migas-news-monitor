"use client";

import React from "react";
import { setSidebarCollapsed } from "@/lib/actions/sidebar";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

interface SidebarProviderProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}

export function SidebarProvider({
  children,
  initialCollapsed = false,
}: Readonly<SidebarProviderProps>) {
  // Initialize from server-provided value (from cookie)
  const [isCollapsed, setIsCollapsed] = React.useState(initialCollapsed);

  // Persist to cookie on change (skip initial render)
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Fire and forget - update cookie in background
    setSidebarCollapsed(isCollapsed);
  }, [isCollapsed]);

  const toggle = React.useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const collapse = React.useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expand = React.useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const value = React.useMemo(
    () => ({ isCollapsed, toggle, collapse, expand }),
    [isCollapsed, toggle, collapse, expand],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
