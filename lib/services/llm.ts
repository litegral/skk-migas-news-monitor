/**
 * Groq LLM service for article analysis.
 *
 * Uses the Groq OpenAI-compatible API (chat completions)
 * to generate summaries, sentiment labels, and categories for articles.
 *
 * Model: configurable via GROQ_MODEL (default: llama-3.3-70b-versatile).
 *
 * Uses direct fetch with response_format: json_object for structured JSON output.
 */

import { z } from "zod";
import type { Sentiment } from "@/lib/types/news";

const API_BASE = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1";

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

// Valid category values for our zod validation (Indonesian).
const VALID_CATEGORIES = [
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
] as const;

/**
 * System prompt that instructs the LLM to return structured JSON analysis.
 * Includes explicit JSON schema for json_object mode compatibility.
 */
const SYSTEM_PROMPT = `You are a professional news analyst for the Indonesian oil & gas sector, specifically monitoring news relevant to SKK Migas (Kalimantan-Sulawesi region).

Your task is to analyze the provided article and return a JSON object with the following structure:

{
  "summary": "string - Very concise 2-3 sentences in Indonesian focusing on key facts and impact on the oil & gas sector",
  "sentiment": "positive" | "negative" | "neutral",
  "categories": ["string"] - Array of 1-4 categories from the allowed list,
  "reason": "string - Brief 1-2 sentence explanation in Indonesian justifying the sentiment"
}

Sentiment Guidelines:
- "positive": Good news, economic growth, discoveries, increased production, successful projects, CSR activities, community development.
- "negative": Accidents, environmental issues, production decline, regulatory problems, protests, delays.
- "neutral": Routine announcements or factual reporting without clear positive/negative impact.

Allowed Categories (select 1-4 most relevant):
- Produksi (production volumes, lifting targets)
- Eksplorasi (exploration, discoveries, seismic surveys)
- Regulasi (regulations, policies, contracts, government)
- Investasi (investments, funding, capital expenditure)
- Lingkungan (environmental issues, sustainability)
- Infrastruktur (pipelines, facilities, construction)
- Keselamatan (safety, HSE, incidents)
- Personel (personnel, HR, leadership changes)
- Pasar (market, prices, trading)
- Komunitas (community relations, CSR, social programs)
- Teknologi (technology, innovation, digitalization)
- Umum (general news that doesn't fit other categories)

IMPORTANT: You must respond with ONLY a valid JSON object, no markdown, no explanation, just the JSON.`;

/**
 * Zod schema for validating and parsing LLM response.
 */
const AnalysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  categories: z.array(z.string()),
  reason: z.string(),
});

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Groq chat completions API (OpenAI-compatible).
 * Uses json_object mode for structured JSON output.
 */
async function callGroq(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string | null; error: string | null }> {
  const url = `${API_BASE}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return { content: null, error: `API error ${response.status}: ${errorText}` };
  }

  const data = await response.json();

  // Extract content from OpenAI-compatible response
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return { content: null, error: "No content in API response" };
  }

  return { content, error: null };
}

/**
 * Analyze a single article using the Groq LLM.
 *
 * @param input.title    - Article title.
 * @param input.snippet  - Short snippet/description.
 * @param input.content  - Full article content (from crawler), if available.
 * @returns Analysis response with data and optional error.
 */
export async function analyzeArticle(input: {
  title: string;
  snippet: string | null;
  content: string | null;
}): Promise<AnalysisResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  const modelId = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    console.error("[llm] GROQ_API_KEY is not set");
    return { data: null, error: "Groq API key is not configured" };
  }

  // Validate title
  if (!input.title || input.title.trim().length === 0) {
    return { data: null, error: "Article title is required" };
  }

  // Build the user prompt with available content.
  const userPrompt = buildUserPrompt(input);

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { content, error: apiError } = await callGroq(
        apiKey,
        modelId,
        SYSTEM_PROMPT,
        userPrompt,
      );

      if (apiError) {
        lastError = apiError;
        console.warn(`[llm] Attempt ${attempt}/${maxRetries} failed: ${apiError}`);
        if (attempt < maxRetries) {
          await sleep(1000 * attempt); // Exponential backoff: 1s, 2s, 3s
          continue;
        }
        break;
      }

      if (!content) {
        lastError = "Empty response from API";
        continue;
      }

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        lastError = `Invalid JSON response: ${content.slice(0, 100)}...`;
        console.warn(`[llm] Attempt ${attempt}/${maxRetries} - ${lastError}`);
        if (attempt < maxRetries) {
          await sleep(1000 * attempt);
          continue;
        }
        break;
      }

      // Validate with Zod schema
      const validated = AnalysisSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = `Schema validation failed: ${validated.error.message}`;
        console.warn(`[llm] Attempt ${attempt}/${maxRetries} - ${lastError}`);
        if (attempt < maxRetries) {
          await sleep(1000 * attempt);
          continue;
        }
        break;
      }

      // Sanitize categories - only keep valid ones
      const validCategoriesSet = new Set<string>(VALID_CATEGORIES);
      const sanitizedCategories = validated.data.categories.filter((c) =>
        validCategoriesSet.has(c)
      );
      if (sanitizedCategories.length === 0) {
        sanitizedCategories.push("Umum");
      }

      const analysisResult: AnalysisResult = {
        summary: validated.data.summary,
        sentiment: validated.data.sentiment as Sentiment,
        categories: sanitizedCategories,
        reason: validated.data.reason,
      };

      console.log(`[llm] Successfully analyzed: "${input.title.slice(0, 50)}..."`);
      return { data: analysisResult, error: null };

    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error occurred";
      console.warn(`[llm] Attempt ${attempt}/${maxRetries} exception: ${lastError}`);
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error(`[llm] Analysis failed for "${input.title}": ${lastError}`);
  return { data: null, error: lastError };
}

/**
 * Build the user message for the LLM, preferring full content when available.
 * Implements context window protection by truncating excessively long articles.
 */
function buildUserPrompt(input: {
  title: string;
  snippet: string | null;
  content: string | null;
}): string {
  // Protect context window: rough approximation (1 char ~ 0.25 tokens).
  // 15,000 chars is roughly 3,750 tokens, safe for most API providers and cost-effective.
  const MAX_CHARS = 15000;

  let body = "";
  if (input.content) {
    body = input.content.length > MAX_CHARS
      ? input.content.substring(0, MAX_CHARS) + "\n\n[Content truncated for length]"
      : input.content;
  } else if (input.snippet) {
    body = input.snippet;
  } else {
    body = "No content available.";
  }

  return `Analyze the following article and return the JSON analysis:\n\nTitle: ${input.title}\n\nArticle Content:\n${body}`;
}
