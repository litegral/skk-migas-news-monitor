/**
 * Shared tenant: all authenticated users read/write the same rows in
 * rss_feeds, topics, and articles (canonical owner = SHARED_DATA_USER_ID).
 */

/**
 * Returns the Supabase Auth user UUID that owns shared RSS/topics/articles rows.
 * Must match the UUID used in migration `010_shared_data_all_accounts.sql` and exist in auth.users.
 */
export function getSharedUserId(): string {
  const id = process.env.SHARED_DATA_USER_ID?.trim();
  if (!id) {
    throw new Error(
      "SHARED_DATA_USER_ID is not set. Create a dedicated user in Supabase Auth and set the env var.",
    );
  }
  return id;
}
