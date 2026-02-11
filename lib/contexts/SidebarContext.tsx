"use client";

import React from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  React.useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    }
  }, [isCollapsed, isHydrated]);

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
