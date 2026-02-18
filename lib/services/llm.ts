/**
 * SiliconFlow LLM service for article analysis.
 *
 * Uses the SiliconFlow API (OpenAI-compatible chat completions format)
 * to generate summaries, sentiment labels, and categories for articles.
 *
 * Model: meta-llama/Llama-3.3-70B-Instruct (configurable via SILICONFLOW_MODEL).
 *
 * HARDENED: Includes timeout (60s), retry with exponential backoff, and proper error returns.
 */

import type { Sentiment } from "@/lib/types/news";
import { fetchWithTimeout, FetchTimeoutError } from "@/lib/utils/fetchWithTimeout";
import { withRetry } from "@/lib/utils/withRetry";

const API_BASE = process.env.SILICONFLOW_API_BASE || "https://api.siliconflow.com/v1";

/** Timeout for LLM requests (60 seconds - LLM calls are slower) */
const REQUEST_TIMEOUT_MS = 60_000;

/** Result shape returned by `analyzeArticle`. */
export interface AnalysisResult {
  summary: string;
  sentiment: Sentiment;
  categories: string[];
  reason: string;
}

/** Result type for analyzeArticle with error handling */
export interface AnalysisResponse {
  data: AnalysisResult | null;
  error: string | null;
}

/**
 * System prompt that instructs the LLM to return structured JSON analysis.
 * Categories are in Indonesian for Indonesian users.
 */
const SYSTEM_PROMPT = `You are a professional news analyst for the Indonesian oil & gas sector, specifically monitoring news relevant to SKK Migas (Special Task Force for Upstream Oil and Gas Business Activities) and the Kalimantan-Sulawesi (Kalsul) region.

Analyze the provided news article and return a JSON object with exactly these fields:

1. "summary": A concise 2-3 sentence summary in Indonesian. Focus on the key facts, who is involved, and the impact on the oil & gas sector.

2. "sentiment": Exactly one of "positive", "negative", or "neutral".
   - "positive": Good news for SKK Migas, oil/gas sector, economic growth, new discoveries, increased production, successful projects.
   - "negative": Bad news like accidents, environmental issues, production decline, regulatory problems, corruption, protests.
   - "neutral": Factual reporting, policy updates, routine announcements without clear positive/negative impact.

3. "categories": An array of 1-4 relevant category labels from this list (use these exact Indonesian labels):
   - "Produksi" (output, lifting, target produksi)
   - "Eksplorasi" (blok baru, penemuan, survei)
   - "Regulasi" (kebijakan, kepatuhan, keputusan pemerintah)
   - "Investasi" (pendanaan, kontrak, kemitraan)
   - "Lingkungan" (dampak lingkungan, keberlanjutan, tumpahan minyak)
   - "Infrastruktur" (pipa, kilang, fasilitas)
   - "Keselamatan" (kecelakaan, insiden, K3/HSE)
   - "Personel" (penunjukan, tenaga kerja, perubahan organisasi)
   - "Pasar" (harga, penawaran/permintaan, perdagangan)
   - "Komunitas" (dampak sosial, CSR, keterlibatan masyarakat)
   - "Teknologi" (inovasi, transformasi digital)
   - "Umum" (lain-lain)

4. "reason": A brief 1-2 sentence explanation in Indonesian of why you chose this sentiment. Explain the key factors from the article content that determined whether the news is positive, negative, or neutral for the oil & gas sector.

Return ONLY valid JSON. No markdown formatting, no code fences, no explanations outside the JSON.

Example output:
{"summary":"SKK Migas melaporkan peningkatan produksi minyak mentah sebesar 5% di wilayah Kalimantan Timur selama Q1 2026. Peningkatan ini didorong oleh keberhasilan program enhanced oil recovery di beberapa blok migas.","sentiment":"positive","categories":["Produksi","Teknologi"],"reason":"Berita ini positif karena melaporkan peningkatan produksi minyak sebesar 5% yang menunjukkan keberhasilan program EOR, menguntungkan SKK Migas dan sektor migas secara keseluruhan."}`;

/**
 * Analyze a single article using the SiliconFlow LLM.
 *
 * @param input.title    - Article title.
 * @param input.snippet  - Short snippet/description.
 * @param input.content  - Full article content (from Crawl4AI), if available.
 * @returns Analysis response with data and optional error.
 */
export async function analyzeArticle(input: {
  title: string;
  snippet: string | null;
  content: string | null;
}): Promise<AnalysisResponse> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const model = process.env.SILICONFLOW_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct";

  if (!apiKey) {
    console.error("[llm] SILICONFLOW_API_KEY is not set");
    return { data: null, error: "SiliconFlow API key is not configured" };
  }

  // Validate title
  if (!input.title || input.title.trim().length === 0) {
    return { data: null, error: "Article title is required" };
  }

  // Build the user prompt with available content.
  const userPrompt = buildUserPrompt(input);

  try {
    const result = await withRetry(
      async () => {
        const response = await fetchWithTimeout(`${API_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 512,
            response_format: { type: "json_object" },
          }),
          cache: "no-store",
          timeoutMs: REQUEST_TIMEOUT_MS,
        });

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`[llm] SiliconFlow ${errorMsg}`);
          throw new Error(errorMsg);
        }

        return response;
      },
      {
        maxRetries: 3,
        initialDelayMs: 2000, // Longer initial delay for LLM
        backoffMultiplier: 2,
        maxDelayMs: 30000,
        onRetry: (error, attempt, delayMs) => {
          console.warn(
            `[llm] Attempt ${attempt} failed, retrying in ${delayMs}ms:`,
            error instanceof Error ? error.message : error
          );
        },
      }
    );

    const json = await result.json();
    const raw = json.choices?.[0]?.message?.content;

    if (!raw) {
      console.error("[llm] Empty response from SiliconFlow");
      return { data: null, error: "Empty response from LLM" };
    }

    const analysisResult = parseAnalysisResponse(raw);
    if (!analysisResult) {
      return { data: null, error: "Failed to parse LLM response" };
    }

    console.log(`[llm] Successfully analyzed: "${input.title.slice(0, 50)}..."`);
    return { data: analysisResult, error: null };
  } catch (err) {
    let errorMsg: string;

    if (err instanceof FetchTimeoutError) {
      errorMsg = `Request timed out after ${REQUEST_TIMEOUT_MS}ms`;
    } else if (err instanceof Error) {
      errorMsg = err.message;
    } else {
      errorMsg = "Unknown error occurred";
    }

    console.error(`[llm] Analysis failed for "${input.title}":`, errorMsg);
    return { data: null, error: errorMsg };
  }
}

/**
 * Build the user message for the LLM, preferring full content when available.
 */
function buildUserPrompt(input: {
  title: string;
  snippet: string | null;
  content: string | null;
}): string {
  const parts: string[] = [`Title: ${input.title}`];

  if (input.content) {
    parts.push(`\nFull Article Content:\n${input.content}`);
  } else if (input.snippet) {
    parts.push(`\nSnippet: ${input.snippet}`);
  }

  return parts.join("\n");
}

/**
 * Valid sentiment values for validation.
 */
const VALID_SENTIMENTS = new Set<Sentiment>(["positive", "negative", "neutral"]);

/**
 * Valid category values for validation (Indonesian).
 */
const VALID_CATEGORIES = new Set([
  "Produksi",
  "Eksplorasi",
  "Regulasi",
  "Investasi",
  "Lingkungan",
  "Infrastruktur",
  "Keselamatan",
  "Personel",
  "Pasar",
  "Komunitas",
  "Teknologi",
  "Umum",
]);

/**
 * Parse and validate the LLM's JSON response.
 */
function parseAnalysisResponse(raw: string): AnalysisResult | null {
  try {
    // Sometimes the LLM wraps in markdown fences despite instructions.
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    // Validate summary
    const summary = typeof parsed.summary === "string" ? parsed.summary : null;
    if (!summary) {
      console.error("[llm] Missing or invalid summary in response");
      return null;
    }

    // Validate sentiment
    const sentiment = typeof parsed.sentiment === "string"
      ? (parsed.sentiment.toLowerCase() as Sentiment)
      : null;
    if (!sentiment || !VALID_SENTIMENTS.has(sentiment)) {
      console.error("[llm] Invalid sentiment:", parsed.sentiment);
      return null;
    }

    // Validate categories
    const rawCategories = Array.isArray(parsed.categories)
      ? parsed.categories
      : [];
    const categories = rawCategories
      .filter((c): c is string => typeof c === "string")
      .filter((c) => VALID_CATEGORIES.has(c));

    // If no valid categories, default to "Umum" (General).
    if (categories.length === 0) {
      categories.push("Umum");
    }

    // Validate reason (optional — fallback to empty string if LLM omits it)
    const reason = typeof parsed.reason === "string"
      ? parsed.reason.trim()
      : "";

    return { summary, sentiment, categories, reason };
  } catch (err) {
    console.error("[llm] Failed to parse LLM response:", err, "\nRaw:", raw);
    return null;
  }
}
