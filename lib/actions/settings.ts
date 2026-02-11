"use server";

/**
 * Server actions for managing user settings (RSS feeds, search queries, and topics).
 *
 * HARDENED: Includes strict input validation for all user inputs.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateString, validateUuid } from "@/lib/utils/validateInput";
import { validateUrl } from "@/lib/utils/validateUrl";

interface ActionResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// RSS Feeds Actions
// ============================================================================

export async function addRSSFeed(
  name: string,
  url: string,
): Promise<ActionResult> {
  try {
    // Validate inputs
    const nameValidation = validateString(name, "Feed name", {
      minLength: 1,
      maxLength: 100,
    });
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error };
    }

    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return { success: false, error: `Invalid URL: ${urlValidation.error}` };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.from("rss_feeds").insert({
      user_id: user.id,
      name: nameValidation.value!,
      url: urlValidation.normalizedUrl!,
      enabled: true,
    });

    if (error) {
      // Handle unique constraint violation
      if (error.code === "23505") {
        return { success: false, error: "This feed URL already exists" };
      }
      console.error("[settings] addRSSFeed error:", error.message);
      return { success: false, error: "Failed to add feed" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] addRSSFeed error:", err);
    return { success: false, error: "Failed to add feed" };
  }
}

export async function updateRSSFeed(
  id: string,
  data: { name?: string; url?: string; enabled?: boolean },
): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Feed ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    // Validate optional fields
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      const nameValidation = validateString(data.name, "Feed name", {
        minLength: 1,
        maxLength: 100,
      });
      if (!nameValidation.valid) {
        return { success: false, error: nameValidation.error };
      }
      updateData.name = nameValidation.value;
    }

    if (data.url !== undefined) {
      const urlValidation = validateUrl(data.url);
      if (!urlValidation.valid) {
        return { success: false, error: `Invalid URL: ${urlValidation.error}` };
      }
      updateData.url = urlValidation.normalizedUrl;
    }

    if (data.enabled !== undefined) {
      if (typeof data.enabled !== "boolean") {
        return { success: false, error: "Enabled must be a boolean" };
      }
      updateData.enabled = data.enabled;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("rss_feeds")
      .update(updateData)
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This feed URL already exists" };
      }
      console.error("[settings] updateRSSFeed error:", error.message);
      return { success: false, error: "Failed to update feed" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] updateRSSFeed error:", err);
    return { success: false, error: "Failed to update feed" };
  }
}

export async function deleteRSSFeed(id: string): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Feed ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("rss_feeds")
      .delete()
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      console.error("[settings] deleteRSSFeed error:", error.message);
      return { success: false, error: "Failed to delete feed" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] deleteRSSFeed error:", err);
    return { success: false, error: "Failed to delete feed" };
  }
}

// ============================================================================
// Search Queries Actions
// ============================================================================

export async function addSearchQuery(query: string): Promise<ActionResult> {
  try {
    // Validate query
    const queryValidation = validateString(query, "Search query", {
      minLength: 1,
      maxLength: 200,
    });
    if (!queryValidation.valid) {
      return { success: false, error: queryValidation.error };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.from("search_queries").insert({
      user_id: user.id,
      query: queryValidation.value!,
      enabled: true,
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This query already exists" };
      }
      console.error("[settings] addSearchQuery error:", error.message);
      return { success: false, error: "Failed to add query" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] addSearchQuery error:", err);
    return { success: false, error: "Failed to add query" };
  }
}

export async function updateSearchQuery(
  id: string,
  data: { query?: string; enabled?: boolean },
): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Query ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    // Validate optional fields
    const updateData: Record<string, unknown> = {};

    if (data.query !== undefined) {
      const queryValidation = validateString(data.query, "Search query", {
        minLength: 1,
        maxLength: 200,
      });
      if (!queryValidation.valid) {
        return { success: false, error: queryValidation.error };
      }
      updateData.query = queryValidation.value;
    }

    if (data.enabled !== undefined) {
      if (typeof data.enabled !== "boolean") {
        return { success: false, error: "Enabled must be a boolean" };
      }
      updateData.enabled = data.enabled;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("search_queries")
      .update(updateData)
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This query already exists" };
      }
      console.error("[settings] updateSearchQuery error:", error.message);
      return { success: false, error: "Failed to update query" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] updateSearchQuery error:", err);
    return { success: false, error: "Failed to update query" };
  }
}

export async function deleteSearchQuery(id: string): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Query ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("search_queries")
      .delete()
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      console.error("[settings] deleteSearchQuery error:", error.message);
      return { success: false, error: "Failed to delete query" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] deleteSearchQuery error:", err);
    return { success: false, error: "Failed to delete query" };
  }
}

// ============================================================================
// Topics Actions
// ============================================================================

export async function addTopic(
  name: string,
  keywords: string[] = [],
): Promise<ActionResult> {
  try {
    // Validate name
    const nameValidation = validateString(name, "Topic name", {
      minLength: 1,
      maxLength: 150,
    });
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error };
    }

    // Validate keywords (max 20 keywords, each max 100 chars)
    if (!Array.isArray(keywords)) {
      return { success: false, error: "Keywords must be an array" };
    }
    if (keywords.length > 20) {
      return { success: false, error: "Maximum 20 keywords allowed" };
    }
    const validatedKeywords: string[] = [];
    for (const kw of keywords) {
      const kwValidation = validateString(kw, "Keyword", {
        minLength: 1,
        maxLength: 100,
      });
      if (!kwValidation.valid) {
        return { success: false, error: kwValidation.error };
      }
      validatedKeywords.push(kwValidation.value!);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.from("topics").insert({
      user_id: user.id,
      name: nameValidation.value!,
      keywords: validatedKeywords,
      enabled: true,
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This topic already exists" };
      }
      console.error("[settings] addTopic error:", error.message);
      return { success: false, error: "Failed to add topic" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] addTopic error:", err);
    return { success: false, error: "Failed to add topic" };
  }
}

export async function updateTopic(
  id: string,
  data: { name?: string; enabled?: boolean; keywords?: string[] },
): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Topic ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    // Validate optional fields
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      const nameValidation = validateString(data.name, "Topic name", {
        minLength: 1,
        maxLength: 150,
      });
      if (!nameValidation.valid) {
        return { success: false, error: nameValidation.error };
      }
      updateData.name = nameValidation.value;
    }

    if (data.enabled !== undefined) {
      if (typeof data.enabled !== "boolean") {
        return { success: false, error: "Enabled must be a boolean" };
      }
      updateData.enabled = data.enabled;
    }

    if (data.keywords !== undefined) {
      if (!Array.isArray(data.keywords)) {
        return { success: false, error: "Keywords must be an array" };
      }
      if (data.keywords.length > 20) {
        return { success: false, error: "Maximum 20 keywords allowed" };
      }
      const validatedKeywords: string[] = [];
      for (const kw of data.keywords) {
        const kwValidation = validateString(kw, "Keyword", {
          minLength: 1,
          maxLength: 100,
        });
        if (!kwValidation.valid) {
          return { success: false, error: kwValidation.error };
        }
        validatedKeywords.push(kwValidation.value!);
      }
      updateData.keywords = validatedKeywords;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("topics")
      .update(updateData)
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This topic already exists" };
      }
      console.error("[settings] updateTopic error:", error.message);
      return { success: false, error: "Failed to update topic" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] updateTopic error:", err);
    return { success: false, error: "Failed to update topic" };
  }
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  try {
    // Validate ID
    const idValidation = validateUuid(id, "Topic ID");
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("topics")
      .delete()
      .eq("id", idValidation.value!)
      .eq("user_id", user.id);

    if (error) {
      console.error("[settings] deleteTopic error:", error.message);
      return { success: false, error: "Failed to delete topic" };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[settings] deleteTopic error:", err);
    return { success: false, error: "Failed to delete topic" };
  }
}
