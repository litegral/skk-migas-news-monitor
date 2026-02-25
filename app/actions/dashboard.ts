"use server";

import { revalidatePath } from "next/cache";

/**
 * Server action to explicitly revalidate the dashboard page.
 * Used after background processes (fetching, analyzing) complete
 * to refresh the Server Components without a full page reload.
 */
export async function revalidateDashboardAction() {
    revalidatePath("/dashboard");
    return { success: true };
}
