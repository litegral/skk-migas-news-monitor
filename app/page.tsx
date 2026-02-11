import { redirect } from "next/navigation";

/**
 * Root page -- redirects to the dashboard.
 * The proxy.ts + dashboard layout handle auth checks;
 * unauthenticated users will end up at /login.
 */
export default function HomePage() {
  redirect("/dashboard");
}
