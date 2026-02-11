/**
 * URL validation utilities.
 * Prevents SSRF attacks and validates URL format.
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/** List of blocked IP patterns for SSRF protection */
const BLOCKED_IP_PATTERNS = [
  // Localhost
  /^127\./,
  /^0\./,
  /^localhost$/i,
  // Private networks (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  // Loopback IPv6
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  // AWS metadata endpoint
  /^169\.254\.169\.254$/,
];

/** Blocked hostnames for SSRF protection */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
];

/**
 * Validate a URL for safety and format.
 *
 * @param url - The URL string to validate
 * @param options - Validation options
 * @returns Validation result with normalized URL if valid
 */
export function validateUrl(
  url: string,
  options: {
    /** Require HTTPS. Default: false (allows HTTP and HTTPS) */
    requireHttps?: boolean;
    /** Allow data: URLs. Default: false */
    allowDataUrls?: boolean;
    /** Maximum URL length. Default: 2048 */
    maxLength?: number;
  } = {}
): UrlValidationResult {
  const { requireHttps = false, allowDataUrls = false, maxLength = 2048 } = options;

  // Check for empty or whitespace-only URL
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return { valid: false, error: "URL is required" };
  }

  // Check length
  if (trimmedUrl.length > maxLength) {
    return { valid: false, error: `URL exceeds maximum length of ${maxLength} characters` };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check protocol
  const allowedProtocols = ["http:", "https:"];
  if (allowDataUrls) {
    allowedProtocols.push("data:");
  }

  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      error: `Invalid protocol: ${parsedUrl.protocol}. Allowed: ${allowedProtocols.join(", ")}`,
    };
  }

  // Require HTTPS if specified
  if (requireHttps && parsedUrl.protocol !== "https:") {
    return { valid: false, error: "HTTPS is required" };
  }

  // Skip hostname checks for data: URLs
  if (parsedUrl.protocol === "data:") {
    return { valid: true, normalizedUrl: trimmedUrl };
  }

  // Check for blocked hostnames
  const hostname = parsedUrl.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: `Blocked hostname: ${hostname}` };
  }

  // Check for blocked IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: `Blocked IP address: ${hostname}` };
    }
  }

  // Check for empty hostname
  if (!hostname) {
    return { valid: false, error: "URL must have a hostname" };
  }

  return { valid: true, normalizedUrl: parsedUrl.href };
}

/**
 * Simple check if a URL is valid and safe.
 *
 * @param url - The URL to check
 * @returns true if valid and safe, false otherwise
 */
export function isValidUrl(url: string): boolean {
  return validateUrl(url).valid;
}

/**
 * Validate a URL and throw if invalid.
 *
 * @param url - The URL to validate
 * @param context - Context for error message (e.g., "RSS feed URL")
 * @returns The normalized URL
 * @throws Error if URL is invalid
 */
export function assertValidUrl(url: string, context = "URL"): string {
  const result = validateUrl(url);
  if (!result.valid) {
    throw new Error(`Invalid ${context}: ${result.error}`);
  }
  return result.normalizedUrl!;
}
