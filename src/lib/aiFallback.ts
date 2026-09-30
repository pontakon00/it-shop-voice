import { ACTIVE_PROFILE } from "./assistantProfile";
import { CATEGORY_LABELS } from "./matching";
import type { ProductMatch } from "./types";

/**
 * AI Fallback — เมื่อค้นสินค้าไม่เจอ ให้ถาม n8n workflow แทนการตอบว่า "ไม่พบ"
 *
 * เส้นทางการเรียก:
 *   Next.js  →  n8n (Webhook)  →  Groq API  →  n8n (Parse + Respond)  →  Next.js
 *
 * คีย์ Groq ไม่ได้อยู่ในเว็บนี้ แต่อยู่ใน n8n เป็น credential แบบ Header Auth
 * ดังนั้นเว็บไม่เคยเห็นคีย์ API และเปลี่ยนผู้ให้บริการ LLM ได้โดยไม่ต้องแก้โค้ดฝั่งเว็บ
 *
 * เรื่องความแม่นยำ — สิ่งที่ทำให้ระบบนี้ไม่กุข้อมูล:
 *   โมเดลไม่ได้ตอบจากความจำของตัวเอง แต่ตอบจาก `catalog` ที่ดึงจากฐานข้อมูลจริง
 *   นี่คือ RAG แบบเรียบง่าย (ยังไม่ใช้ embedding — ใช้ fuzzy matching ที่มีอยู่แล้ว)
 *   ถ้า `catalog` ว่าง = ไม่มีสินค้าที่เกี่ยวข้อง โมเดลจะตอบว่าไม่มีตามจริง
 */

export type AiAnswer = {
  answer: string;
  suggestions: string[];
};

/** สินค้าที่ระบบดึงมาจากฐานข้อมูลแล้วแนบให้ AI อ้างอิงได้เฉพาะรายการนี้ */
export type AiCatalogItem = {
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
};

/**
 * ตัดเหลือเฉพาะฟิลด์ที่ AI ต้องใช้ตอบคำถาม
 *
 * ไม่ส่ง `description` / `features` เพราะเป็นกินโทเคนที่ไม่ได้ประโยชน์
 * และชื่อสินค้าต้องอยู่ใน user message เสมอ ไม่ใช่ system prompt
 * เพราะชื่อสินค้าเป็นข้อมูลจากฐานข้อมูลที่ถือเป็น untrusted input
 */
export function toAiCatalog(matches: ProductMatch[]): AiCatalogItem[] {
  return matches.map(({ product }) => ({
    name: product.name,
    category: CATEGORY_LABELS[product.category],
    price: product.price,
    stock: product.stock,
    rating: product.rating,
  }));
}

const DEFAULT_TIMEOUT_MS = 8000;

function getTimeoutMs(): number {
  const raw = Number(process.env.N8N_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * ส่งคำถามไปยัง n8n workflow
 *
 * ส่งทั้ง `query` (คำค้นที่ NLU ทำความสะอาดแล้ว) และ `transcript` (ประโโยคดิดของผู้ใช้)
 * เพราะ NLU ตัดคำฟุ่มออกจนบริบทภาษาไทยหาย เช่น
 * "ช่วยแนะนำสูตรอาหารอร่อยๆ" → "สูตรอา รอร่อยๆ"
 * ถ้าส่งแค่ `query` โมเดลจะเห็นคำที่แตกชิ้น
 *
 * คืน null เสมอเมื่อไม่มีการตั้งค่า / n8n ไม่ทำงาน / ตอบกลับไม่ถูก format
 * เพราะ AI Fallback เป็นฟีเจอร์เสริม ต้องไม่ทำให้ระบบหลักล่ม
 */
export async function askAiFallback(input: {
  query: string;
  transcript: string;
  catalog: AiCatalogItem[];
}): Promise<AiAnswer | null> {
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
        catalog: input.catalog,
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
