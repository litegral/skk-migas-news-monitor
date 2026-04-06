"use server";

import { cookies } from "next/headers";

import type { DashboardPeriod } from "@/lib/types/dashboard";
import { PERIOD_OPTIONS } from "@/lib/types/dashboard";

const COOKIE_NAME = "dashboard-period";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isValidPeriod(value: string): value is DashboardPeriod {
  return PERIOD_OPTIONS.some((o) => o.value === value);
}

export async function setDashboardPeriod(period: string): Promise<void> {
  if (!isValidPeriod(period)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, period, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function getDashboardPeriodFromCookie(): Promise<DashboardPeriod | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (raw && isValidPeriod(raw)) {
    return raw;
  }
  return null;
}
