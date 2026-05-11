import { openrouter } from "@workspace/integrations-openrouter-ai";
import { logger } from "./logger";

export const VISION_MODEL = "openai/gpt-4o-mini";
export const TEXT_MODEL = "openai/gpt-4o-mini";

export class AiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return trimmed;
}

export function parseJson<T = unknown>(text: string): T {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new AiError("Failed to parse AI response as JSON", err);
  }
}

export async function chatJson<T>(opts: {
  system: string;
  user: string;
  imageDataUrl?: string;
  model?: string;
}): Promise<T> {
  const model = opts.model ?? (opts.imageDataUrl ? VISION_MODEL : TEXT_MODEL);
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: opts.user }];
  if (opts.imageDataUrl) {
    userContent.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  }
  try {
    const response = await openrouter.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
    });
    const text = response.choices[0]?.message?.content ?? "";
    if (!text) throw new AiError("Empty AI response");
    return parseJson<T>(text);
  } catch (err) {
    logger.error({ err }, "AI request failed");
    if (err instanceof AiError) throw err;
    throw new AiError(err instanceof Error ? err.message : "AI request failed", err);
  }
}
