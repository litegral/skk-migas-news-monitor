/**
 * SiliconFlow LLM service for article analysis.
 *
 * Uses the SiliconFlow API (OpenAI-compatible chat completions format)
 * to generate summaries, sentiment labels, and categories for articles.
 *
 * Model: meta-llama/Llama-3.3-70B-Instruct (configurable via SILICONFLOW_MODEL).
 */

import type { Sentiment } from "@/lib/types/news";

const API_BASE = "https://api.siliconflow.cn/v1";

/** Result shape returned by `analyzeArticle`. */
export interface AnalysisResult {
  summary: string;
  sentiment: Sentiment;
  categories: string[];
}

/**
 * System prompt that instructs the LLM to return structured JSON analysis.
 */
const SYSTEM_PROMPT = `You are a professional news analyst for the Indonesian oil & gas sector, specifically monitoring news relevant to SKK Migas (Special Task Force for Upstream Oil and Gas Business Activities) and the Kalimantan-Sulawesi (Kalsul) region.

Analyze the provided news article and return a JSON object with exactly these fields:

1. "summary": A concise 2-3 sentence summary in the same language as the article. Focus on the key facts, who is involved, and the impact on the oil & gas sector.

2. "sentiment": Exactly one of "positive", "negative", or "neutral".
   - "positive": Good news for SKK Migas, oil/gas sector, economic growth, new discoveries, increased production, successful projects.
   - "negative": Bad news like accidents, environmental issues, production decline, regulatory problems, corruption, protests.
   - "neutral": Factual reporting, policy updates, routine announcements without clear positive/negative impact.

3. "categories": An array of 1-4 relevant category labels from this list:
   - "Production" (output, lifting, targets)
   - "Exploration" (new blocks, discoveries, surveys)
   - "Regulation" (policy, compliance, government decisions)
   - "Investment" (funding, contracts, partnerships)
   - "Environment" (environmental impact, sustainability, spills)
   - "Infrastructure" (pipelines, refineries, facilities)
   - "Safety" (accidents, incidents, HSE)
   - "Personnel" (appointments, workforce, organizational changes)
   - "Market" (pricing, supply/demand, trade)
   - "Community" (social impact, CSR, local engagement)
   - "Technology" (innovation, digital transformation)
   - "General" (other/miscellaneous)

Return ONLY valid JSON. No markdown formatting, no code fences, no explanations outside the JSON.

Example output:
{"summary":"SKK Migas melaporkan peningkatan produksi minyak mentah sebesar 5% di wilayah Kalimantan Timur selama Q1 2026. Peningkatan ini didorong oleh keberhasilan program enhanced oil recovery di beberapa blok migas.","sentiment":"positive","categories":["Production","Technology"]}`;

/**
 * Analyze a single article using the SiliconFlow LLM.
 *
 * @param input.title    - Article title.
 * @param input.snippet  - Short snippet/description.
 * @param input.content  - Full article content (from Crawl4AI), if available.
 * @returns Analysis result, or null if the LLM call fails.
 */
export async function analyzeArticle(input: {
  title: string;
  snippet: string | null;
  content: string | null;
}): Promise<AnalysisResult | null> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const model = process.env.SILICONFLOW_MODEL || "meta-llama/Llama-3.3-70B-Instruct";

  if (!apiKey) {
    console.error("[llm] SILICONFLOW_API_KEY is not set");
    return null;
  }

  // Build the user prompt with available content.
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
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
    });

    if (!response.ok) {
      console.error(
        `[llm] SiliconFlow HTTP ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const json = await response.json();
    const raw = json.choices?.[0]?.message?.content;

    if (!raw) {
      console.error("[llm] Empty response from SiliconFlow");
      return null;
    }

    return parseAnalysisResponse(raw);
  } catch (err) {
    console.error("[llm] SiliconFlow request failed:", err);
    return null;
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
 * Valid category values for validation.
 */
const VALID_CATEGORIES = new Set([
  "Production",
  "Exploration",
  "Regulation",
  "Investment",
  "Environment",
  "Infrastructure",
  "Safety",
  "Personnel",
  "Market",
  "Community",
  "Technology",
  "General",
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

    // If no valid categories, default to "General".
    if (categories.length === 0) {
      categories.push("General");
    }

    return { summary, sentiment, categories };
  } catch (err) {
    console.error("[llm] Failed to parse LLM response:", err, "\nRaw:", raw);
    return null;
  }
}
