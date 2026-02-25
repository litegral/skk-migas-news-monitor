"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action to explicitly revalidate the dashboard page.
 * Used after background processes (fetching, analyzing) complete
 * to refresh the Server Components without a full page reload.
 */
export async function revalidateDashboardAction() {
    revalidatePath("/dashboard");
    return { success: true };
}

/**
 * Server action to get the current counts for decoding and analysis pending states.
 */
export async function getPendingCountsAction() {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
        return { decodePendingCount: 0, pendingCount: 0 };
    }

    const [decodePendingRes, pendingRes] = await Promise.all([
        supabase
            .from("articles")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", userId)
            .eq("url_decoded", false),
        supabase
            .from("articles")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", userId)
            .eq("ai_processed", false)
            .eq("url_decoded", true)
            .eq("decode_failed", false)
    ]);

    return {
        decodePendingCount: decodePendingRes.count ?? 0,
        pendingCount: pendingRes.count ?? 0
    };
}
