import { NextResponse } from "next/server";
import { askAiFallback, type AiAnswer } from "@/src/lib/aiFallback";
import { SAMPLE_COMMANDS } from "@/src/lib/catalog";
import { CATEGORY_LABELS } from "@/src/lib/matching";
import { parseCommand } from "@/src/lib/nlu";
import { resolveTarget, searchProducts } from "@/src/lib/productRepository";
import type { AnswerSource, VoiceResponse } from "@/src/lib/types";

const MAX_TEXT_LENGTH = 200;
const MAX_MATCHES = 50;
const DISPLAY_MATCHES = 8;

type Payload = Omit<VoiceResponse, "transcript" | "source"> & {
  transcript?: string;
  source?: AnswerSource;
};

function respond(payload: Payload): NextResponse<VoiceResponse> {
  return NextResponse.json({
    transcript: payload.transcript ?? "",
    source: "none" as AnswerSource,
    ...payload,
  });
}

export async function POST(request: Request): Promise<NextResponse<VoiceResponse>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return respond({
      intent: "unknown",
      reply: "ส่งคำสั่งเข้ามาไม่ถูกต้อง ลองใหม่อีกครั้ง",
      confidence: 0,
      query: "",
      quantity: 0,
      budget: {},
      sort: "relevance",
      results: [],
      totalResults: 0,
      suggestion: SAMPLE_COMMANDS.slice(0, 3),
    });
  }

  const rawText = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  const text = rawText.trim();

  if (!text) {
    return respond({
      intent: "unknown",
      reply: "ยังไม่ได้ยินคำสั่ง ลองพูดชื่อสินค้าที่ต้องการดู",
      confidence: 0,
      query: "",
      quantity: 0,
      budget: {},
      sort: "relevance",
      results: [],
      totalResults: 0,
      suggestion: SAMPLE_COMMANDS.slice(0, 3),
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return respond({
      transcript: text.slice(0, MAX_TEXT_LENGTH),
      intent: "unknown",
      reply: "คำสั่งยาวเกินไป กรุณาพูดสั้นลง เช่น หาหูฟังราคาไม่เกิน 3000",
      confidence: 0,
      query: "",
      quantity: 0,
      budget: {},
      sort: "relevance",
      results: [],
      totalResults: 0,
      suggestion: SAMPLE_COMMANDS.slice(0, 3),
    });
  }

  const command = parseCommand(text);

  switch (command.intent) {
    case "greeting":
      return respond({
        transcript: text,
        intent: "greeting",
        reply: "สวัสดีครับ! ผมเป็นผู้ช่วยช้อปปิ้งด้วยเสียง พูดชื่อสินค้าที่ต้องการได้เลยครับ",
        confidence: command.confidence,
        query: command.query,
        quantity: command.quantity,
        budget: command.budget,
        sort: command.sort,
        results: [],
        totalResults: 0,
        suggestion: SAMPLE_COMMANDS.slice(0, 3),
      });

    case "help":
      return respond({
        transcript: text,
        intent: "help",
        reply: "ใช้งานได้ดังนี้ครับ: ค้นหาสินค้า, เพิ่มลงตะกร้า, ลบออก, ดูตะกร้า, สรุปราคา",
        confidence: command.confidence,
        query: command.query,
        quantity: command.quantity,
        budget: command.budget,
        sort: command.sort,
        results: [],
        totalResults: 0,
        suggestion: SAMPLE_COMMANDS,
      });

    case "clear":
    case "cart":
    case "checkout":
      return respond({
        transcript: text,
        intent: command.intent,
        reply:
          command.intent === "clear"
            ? "กำลังล้างตะกร้าให้ครับ"
            : command.intent === "cart"
              ? "นี่คือรายการที่คุณเลือกไว้ครับ"
              : "กำลังสรุปรายการสั่งซื้อของคุณครับ",
        confidence: command.confidence,
        query: command.query,
        quantity: command.quantity,
        budget: command.budget,
        sort: command.sort,
        results: [],
        totalResults: 0,
        suggestion: SAMPLE_COMMANDS.slice(0, 3),
      });

    case "add":
    case "remove": {
      const found = await resolveTarget(command.query);
      const isAdd = command.intent === "add";

      if (!found) {
        return respond({
          transcript: text,
          intent: command.intent,
          reply: "ยังไม่แน่ใจว่าหมายถึงสินค้าตัวไหนครับ ลองพูดชื่อที่ชัดเจนกว่านี้อีกครั้ง",
          confidence: command.confidence,
          query: command.query,
          quantity: command.quantity,
          budget: command.budget,
          sort: command.sort,
          results: [],
          totalResults: 0,
          suggestion: SAMPLE_COMMANDS.slice(0, 3),
        });
      }

      const { match: target, source } = found;
      const qty = isAdd ? Math.max(1, command.quantity) : 1;
      const stockNote = target.product.stock === 0 ? " (สินค้าหมดชั่วคราว)" : "";
      const line = isAdd
        ? `เพิ่ม ${target.product.name} จำนวน ${qty} ชิ้น${stockNote}`
        : `ลบ ${target.product.name} ออกจากตะกร้า${stockNote}`;

      return respond({
        transcript: text,
        intent: command.intent,
        reply: target.reasons.length > 0 ? `${line} — เข้าใจว่าหมายถึง ${target.reasons[0]}` : line,
        confidence: command.confidence,
        query: command.query,
        quantity: qty,
        budget: command.budget,
        sort: command.sort,
        results: [target],
        totalResults: 1,
        source,
        suggestion: [isAdd ? "ดูตะกร้า" : "เพิ่มหูฟัง TWS Pro ลงตะกร้า", "สรุปราคา"],
      });
    }

    case "search":
    case "unknown":
    default: {
      const hasFilter =
        command.category !== undefined ||
        command.budget.min !== undefined ||
        command.budget.max !== undefined ||
        command.sort !== "relevance";

      if (!command.query && !hasFilter) {
        return respond({
          transcript: text,
          intent: "unknown",
          reply: "ยังไม่เข้าใจคำสั่งครับ ลองพูดชื่อสินค้าที่ต้องการ เช่น \"อยากได้หูฟังไร้สาย\"",
          confidence: command.confidence,
          query: "",
          quantity: command.quantity,
          budget: command.budget,
          sort: command.sort,
          results: [],
          totalResults: 0,
          suggestion: SAMPLE_COMMANDS,
        });
      }

      const { matches, total, source } = await searchProducts(command, MAX_MATCHES);
      const results = matches.slice(0, DISPLAY_MATCHES);

      const conditions: string[] = [];
      if (command.budget.max !== undefined) {
        conditions.push(`ราคาไม่เกิน ${command.budget.max.toLocaleString("th-TH")} บาท`);
      }
      if (command.budget.min !== undefined) {
        conditions.push(`ราคาตั้งแต่ ${command.budget.min.toLocaleString("th-TH")} บาท`);
      }
      if (command.category) conditions.push(`หมวด${CATEGORY_LABELS[command.category]}`);

      const conditionText = conditions.length > 0 ? ` (${conditions.join(", ")})` : "";
      const subject = command.query ? `ที่ตรงกับ "${command.query}"` : "ตามที่คุณบอก";

      // ไม่พบสินค้าในฐานข้อมูล → ส่งให้ n8n → Groq ตอบแทน แทนที่จะตอบว่า "ไม่พบ"
      let answerSource: AnswerSource = source;
      let aiAnswer: AiAnswer | undefined;

      if (total === 0 && command.query) {
        const ai = await askAiFallback({ query: command.query, transcript: text });
        if (ai) {
          answerSource = "ai";
          aiAnswer = ai;
        } else {
          answerSource = "none";
        }
      }

      const reply =
        aiAnswer?.answer ??
        (total === 0
          ? `ไม่พบสินค้า${subject}${conditionText} ลองเปลี่ยนคำค้นหรือพูดชื่อหมวดอื่นดูครับ`
          : total === 1
            ? `พบสินค้า 1 รายการ${subject}${conditionText} ครับ`
            : `พบ ${total} รายการ${subject}${conditionText} แสดงให้ดู ${results.length} รายการแรกครับ`);

      return respond({
        transcript: text,
        intent: "search",
        reply,
        confidence: command.confidence,
        query: command.query,
        quantity: command.quantity,
        budget: command.budget,
        sort: command.sort,
        results,
        totalResults: total,
        source: answerSource,
        aiAnswer,
        suggestion:
          aiAnswer && aiAnswer.suggestions.length > 0
            ? aiAnswer.suggestions
            : total > 0
              ? [`เพิ่ม ${results[0].product.name} ลงตะกร้า`, "ดูตะกร้า", "สรุปราคา"]
              : SAMPLE_COMMANDS.slice(0, 3),
      });
    }
  }
}

export function GET() {
  return NextResponse.json(
    { error: "ใช้เมธอด POST พร้อม body เป็น JSON { \"text\": \"...\" } เท่านั้น" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
