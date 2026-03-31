/**
 * Retry Supabase mutations on transient network / transport failures.
 * Does not retry validation, RLS, or other application-level errors.
 */

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error is likely transient (connection reset, timeout, etc.).
 */
function isTransientSupabaseError(error: unknown): boolean {
  if (error === null || error === undefined) return false;

  const parts: string[] = [];
  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    if (e.message) parts.push(e.message);
    if (e.details) parts.push(e.details);
    if (e.hint) parts.push(e.hint);
    if (e.code) parts.push(e.code);
  } else {
    parts.push(String(error));
  }

  const combined = parts.join(" ").toLowerCase();
  return (
    combined.includes("econnreset") ||
    combined.includes("econnrefused") ||
    combined.includes("etimedout") ||
    combined.includes("eai_again") ||
    combined.includes("fetch failed") ||
    combined.includes("network") ||
    combined.includes("socket") ||
    combined.includes("aborted") ||
    combined.includes("tls") ||
    combined.includes("read econnreset")
  );
}

export interface SupabaseMutationResult<E = { message: string }> {
  error: E | null;
}

/**
 * Runs a Supabase mutation (typically `.update().eq()`) up to 3 times on transient errors.
 */
export async function retrySupabaseMutation<E extends { message: string }>(
  label: string,
  execute: () => Promise<SupabaseMutationResult<E>>,
): Promise<SupabaseMutationResult<E>> {
  let last: SupabaseMutationResult<E> = { error: null };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    last = await execute();
    if (!last.error) return last;

    if (!isTransientSupabaseError(last.error) || attempt === MAX_ATTEMPTS) {
      return last;
    }

    const delay =
      BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
    console.warn(
      `[${label}] Transient Supabase error (attempt ${attempt}/${MAX_ATTEMPTS}), retry in ${delay}ms:`,
      last.error.message,
    );
    await sleep(delay);
  }

  return last;
}
