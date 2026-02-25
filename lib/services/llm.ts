/**
 * SiliconFlow LLM service for article analysis.
 *
 * Uses the SiliconFlow API (OpenAI-compatible chat completions format)
 * to generate summaries, sentiment labels, and categories for articles.
 *
 * Model: meta-llama/Llama-3.3-70B-Instruct (configurable via SILICONFLOW_MODEL).
 *
 * HARDENED: Refactored to use Vercel AI SDK and Zod for robust structured outputs.
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Sentiment } from "@/lib/types/news";

const API_BASE = process.env.SILICONFLOW_API_BASE || "https://api.siliconflow.com/v1";

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
const SYSTEM_PROMPT = `You are a professional news analyst for the Indonesian oil & gas sector, specifically monitoring news relevant to SKK Migas (Kalimantan-Sulawesi region).

Your task is to analyze the provided article and extract the required structured data.

Output Guidelines:
1. Summary: Very concise 2-3 sentences in Indonesian focusing on key facts and impact on the oil & gas sector.
2. Sentiment:
   - "positive": Good news, economic growth, discoveries, increased production, successful projects.
   - "negative": Accidents, environmental issues, production decline, regulatory problems, protests.
   - "neutral": Routine announcements or factual reporting without clear positive/negative impact.
3. Reason: Brief 1-2 sentence explanation in Indonesian justifying the chosen sentiment based on article facts.
4. Categories: Select 1-4 most relevant from the allowed list provided in the schema properties.`;

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
 * Zod schema defining the expected output structure from the LLM.
 */
const AnalysisSchema = z.object({
  summary: z.string().describe("A concise 2-3 sentence summary in Indonesian."),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("The sentiment of the article."),
  categories: z.array(z.string()).describe("Array of 1-4 category labels. Must match allowed list."),
  reason: z.string().describe("Brief explanation in Indonesian of why this sentiment was chosen."),
});

/**
 * Configure the SiliconFlow client using Vercel AI SDK's OpenAI compatibility.
 */
function getSiliconFlowClient(apiKey: string) {
  return createOpenAI({
    baseURL: API_BASE,
    apiKey,
  });
}

/**
 * Analyze a single article using the SiliconFlow LLM via Vercel AI SDK.
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
  const modelId = process.env.SILICONFLOW_MODEL || "meta-llama/Llama-3.3-70B-Instruct";

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
  const siliconflow = getSiliconFlowClient(apiKey);

  try {
    const { object } = await generateObject({
      model: siliconflow(modelId),
      schema: AnalysisSchema,
      prompt: userPrompt,
      system: SYSTEM_PROMPT,
      temperature: 0.3,
      // maxRetries handles the exponential backoff from AI SDK
      maxRetries: 3,
    });

    // Enforce category mapping just to be perfectly safe, as LLMs can hallucinate categories sometimes.
    const validCategoriesSet = new Set<string>(VALID_CATEGORIES);
    const sanitizedCategories = object.categories.filter((c: string) => validCategoriesSet.has(c));
    if (sanitizedCategories.length === 0) sanitizedCategories.push("Umum");

    const analysisResult: AnalysisResult = {
      summary: object.summary,
      sentiment: object.sentiment as Sentiment,
      categories: sanitizedCategories,
      reason: object.reason,
    };

    console.log(`[llm] Successfully analyzed: "${input.title.slice(0, 50)}..."`);
    return { data: analysisResult, error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown LLM error occurred";
    console.error(`[llm] Analysis failed for "${input.title}":`, errorMsg);
    return { data: null, error: errorMsg };
  }
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

  return `Title: ${input.title}\n\nArticle Content:\n${body}`;
}
