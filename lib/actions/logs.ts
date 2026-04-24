import { createClient } from "@/lib/supabase/server";
import { Json } from "@/lib/types/database";

export type AdminActionType =
  | "ADD_TOPIC"
  | "UPDATE_TOPIC"
  | "DELETE_TOPIC"
  | "ADD_RSS_FEED"
  | "UPDATE_RSS_FEED"
  | "DELETE_RSS_FEED"
  | "ADD_ARTICLE"
  | "DELETE_ARTICLE"
  | "UPDATE_ARTICLE_SENTIMENT";

export type AdminEntityType = "TOPIC" | "RSS_FEED" | "ARTICLE";

export async function logAdminAction(
  actionType: AdminActionType,
  entityType: AdminEntityType,
  entityId: string,
  entityName: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      console.warn("[logs] logAdminAction: No authenticated user found, skipping log.");
      return;
    }

    const { error } = await supabase.from("admin_logs").insert({
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details: (details as Json) ?? null,
    });

    if (error) {
      console.error("[logs] Failed to insert admin log:", error.message);
    }
  } catch (err) {
    console.error("[logs] logAdminAction error:", err);
  }
}
