/**
 * Fetch wrapper with timeout support using AbortController.
 * Prevents requests from hanging indefinitely.
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds. Default: 30000 (30 seconds) */
  timeoutMs?: number;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

/**
 * Fetch with automatic timeout.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus optional timeoutMs
 * @returns Response object
 * @throws FetchTimeoutError if request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
