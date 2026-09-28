import { ACTIVE_PROFILE } from "./assistantProfile";

/**
 * AI Fallback — เมื่อค้นสินค้าไม่เจอ ให้ถาม n8n workflow แทนการตอบว่า "ไม่พบ"
 *
 * เส้นทางการเรียก:
 *   Next.js  →  n8n (Webhook)  →  Groq API  →  n8n (Parse + Respond)  →  Next.js
 *
 * คีย์ Groq ไม่ได้อยู่ในเว็บนี้ แต่อยู่ใน n8n เป็นตัวแปร GROQ_API_KEY
 * ดังนั้นเว็บไม่เคยเห็นคีย์ API และเปลี่ยนผู้ให้บริการ LLM ได้โดยไม่ต้องแก้โค้ดฝั่งเว็บ
 */

export type AiAnswer = {
  answer: string;
  suggestions: string[];
};

const DEFAULT_TIMEOUT_MS = 8000;

function getTimeoutMs(): number {
  const raw = Number(process.env.N8N_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * ส่งคำถามไปยัง n8n workflow
 *
 * คืน null เสมอเมื่อไม่มีการตั้งค่า / n8n ไม่ทำงาน / ตอบกลับไม่ถูก format
 * เพราะ AI Fallback เป็นฟีเจอร์เสริม ต้องไม่ทำให้ระบบหลักล่ม
 */
export async function askAiFallback(input: { query: string; transcript: string }): Promise<AiAnswer | null> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl || !input.query) return null;

  const profile = ACTIVE_PROFILE;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        transcript: input.transcript,
        profile: {
          key: profile.key,
          label: profile.label,
          domain: profile.domain,
          systemPrompt: profile.systemPrompt,
          categories: profile.categories,
        },
      }),
      signal: AbortSignal.timeout(getTimeoutMs()),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[ai] n8n ตอบกลับสถานะ ${response.status}`);
      return null;
    }

    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return null;

    const payload = data as { answer?: unknown; suggestions?: unknown };
    const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
    if (!answer) return null;

    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
      : [];

    return { answer, suggestions };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error(`[ai] n8n ไม่ตอบภายใน ${getTimeoutMs()} มิลลิวินาที`);
    } else {
      console.error("[ai] เรียก n8n ไม่สำเร็จ:", error instanceof Error ? error.message : error);
    }
    return null;
  }
}
