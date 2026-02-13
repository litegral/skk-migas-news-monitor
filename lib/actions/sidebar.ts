"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "sidebar-collapsed";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, collapsed ? "true" : "false", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function getSidebarCollapsed(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "true";
}
