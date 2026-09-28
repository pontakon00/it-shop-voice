import type { Budget, Category, Intent, ParsedCommand, SortKey } from "./types";

const THAI_DIGITS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

const THAI_NUMBERS: Record<string, number> = {
  หนึ่ง: 1, เอ็ด: 11, สอง: 2, สาม: 3, สี่: 4, ห้า: 5,
  หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10, ยี่สิบ: 20, ร้อย: 100,
};

const UNITS = "อัน|ชิ้น|ใบ|คู่|แพ็ค|กล่อง|ตัว|คัน|เครื่อง|แถม";

type IntentRule = {
  intent: Intent;
  triggers?: string[];
  patterns?: RegExp[];
};

/**
 * เรียงตามความสำคัญ กฎยาวต้องมาก่อนกฎสั้น
 * เช่น "ล้างตะกร้า" ต้องชนกฎ clear ก่อน remove
 * และ "ซื้อของ" ต้องชนกฎ checkout ก่อน add
 *
 * patterns ครอบคลุมการสลับตำแหน่งคำในภาษาไทย เช่น "เอาหูฟังออก"
 */
const INTENT_RULES: IntentRule[] = [
  {
    intent: "greeting",
    triggers: ["สวัสดี", "หวัดดี", "สวัสดีตอนเช้า", "hello", " hi ", "hi there", "hey"],
  },
  {
    intent: "help",
    triggers: ["ช่วยเหลือ", "ช่วยหน่อย", "ใช้ยังไง", "ทำอะไรได้", "วิธีใช้", "คำสั่ง", "help"],
  },
  {
    intent: "clear",
    triggers: ["ล้างตะกร้า", "ลบทั้งหมด", "ลบทุกอย่าง", "ล้างทั้งหมด", "เคลียร์ตะกร้า", "เริ่มการช้อปปิ้งใหม่", "clear cart"],
  },
  {
    intent: "checkout",
    triggers: ["ชำระเงิน", "คิดเงิน", "สรุปราคา", "รวมราคา", "ยืนยันคำสั่งซื้อ", "จ่ายเงิน", "ซื้อของ", "checkout", "confirm order"],
  },
  {
    intent: "remove",
    triggers: ["ลบออกจากตะกร้า", "เอาออกจากตะกร้า", "เอาออก", "ถอนออก", "ตัดออก", "ไม่เอาแล้ว", "ลบ", "remove"],
    patterns: [/เอา[\s\S]{0,40}?ออก/, /ตัด[\s\S]{0,20}?ออก/, /ไม่เอา[\s\S]{0,40}?แล้ว/],
  },
  {
    intent: "add",
    triggers: ["เพิ่มลงตะกร้า", "เพิ่มในตะกร้า", "ใส่ตะกร้า", "ลงตะกร้า", "เพิ่ม", "ขอซื้อ", "ซื้อ", "add to cart", "add"],
    patterns: [/เพิ่ม[\s\S]{0,40}?(ลง|ใส่|เข้า)/, /ใส่[\s\S]{0,40}?(ลง|เข้า)/],
  },
  {
    intent: "cart",
    triggers: ["ในตะกร้า", "ตะกร้า", "รายการที่เลือก", "รายการที่ซื้อ", "ของที่เลือก", "ของในรถ", "cart", "basket"],
  },
];

/**
 * คำที่ระบุหมวดสินค้า — เรียงตามความยาวเพื่อให้ "จอคอม" ชนก่อน "คอม"
 *
 * ต้องครอบคลุมทุกค่าใน CATEGORY_LABELS ด้วย ไม่งั้นผู้ใช้พูดชื่อหมวดตามที่ระบบแสดงผล
 * แล้วระบบจะไม่รู้จัก คนละชื่อกับที่หน้าเว็บเขียนไว้
 */
const CATEGORY_WORDS: Record<string, Category> = {
  "จอคอมพิวเตอร์": "display",
  "คอมพิวเตอร์พกพา": "laptop",
  "นาฬิกาอัจฉริยะ": "wearable",
  "เครื่องใช้ไฟฟ้า": "appliance",
  "จอคอม": "display",
  "จอภาพ": "display",
  "อุปกรณ์เสริม": "accessory",
  "คอมพิวเตอร์": "computer",
  "เครื่องชง": "appliance",
  "คีย์บอร์ด": "computer",
  "หัวชาร์จ": "accessory",
  "ที่ชาร์จ": "accessory",
  "สมาร์ทวอทช์": "wearable",
  "สตอเรจ": "storage",
  "ฮาร์ดดิสก์": "storage",
  "แท็บเล็ต": "tablet",
  "โน้ตบุ๊ก": "laptop",
  "โน้ตบุค": "laptop",
  "แล็ปท็อป": "laptop",
  "นาฬิกา": "wearable",
  "กระเป๋า": "accessory",
  "ลำโพง": "audio",
  "สปีกเกอร์": "audio",
  "เก็บข้อมูล": "storage",
  "แป้นพิมพ์": "computer",
  "คอฟฟี่": "appliance",
  "เดสก์ท็อป": "computer",
  "คอม": "computer",
  "จอ": "display",
  "เมาส์": "computer",
  "หูฟัง": "audio",
  "เสียง": "audio",
  "วอทช์": "wearable",
  "ท็อป": "laptop",
  "ดิสก์": "storage",
  "กาแฟ": "appliance",
  "ตัวชง": "appliance",
  "ssd": "storage",
};

const SORT_WORDS: { sort: SortKey; triggers: string[] }[] = [
  { sort: "price_asc", triggers: ["ราคาถูก", "ถูกที่สุด", "ราคาต่ำ", "ถูกสุด", "ไม่แพง", "cheapest"] },
  { sort: "price_desc", triggers: ["ราคาแพง", "แพงที่สุด", "ราคาสูง", "แพงสุด", "expensive"] },
  { sort: "rating", triggers: ["คะแนน", "ขายดี", "ดีที่สุด", "รีวิว", "คนชอบ", "ยอดนิยม", "popular"] },
  { sort: "newest", triggers: ["ใหม่ที่สุด", "ล่าสุด", "เพิ่งเข้า", "ของใหม่", "newest"] },
];

const FILLER_WORDS = [
  "ช่วยหน่อย", "หน่อย", "ครับ", "คะ", "ค่ะ", "จ้า", "เลย", "ด้วย", "หน่อยนะ", "นะ",
  "อยากได้", "อยากซื้อ", "อยาก", "ขอ", "ช่วย", "หา", "ที่", "แบบ", "สินค้า", "ของ", "ที่สุด",
  "ราคา", "และ", "ก็", "เอา", "ออก", "ดู", "กับ", "ต้องการ", "แนะนำ", "มี",
];

const BUDGET_PATTERNS = {
  max: /(?:ไม่เกิน|ไม่เกี่ยว|ต่ำกว่า|ในงบ|งบประมาณ|max|up to|below)\s*(\d[\d,]*)/,
  min: /(?:มากกว่า|อย่างน้อย|ขั้นต่ำ|ตั้งแต่|above|over|minimum)\s*(\d[\d,]*)/,
};

const toNumber = (raw: string) => Number(raw.replace(/[^\d]/g, ""));

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[๐-๙]/g, (d) => THAI_DIGITS[d])
    .replace(/["'`.,!?;:()[\]/\\]/g, " ")
    .replace(/\s+/g, " ");
}

function findIntent(text: string): { intent: Intent; triggers: string[] } {
  for (const rule of INTENT_RULES) {
    const triggers = (rule.triggers ?? []).filter((t) => text.includes(t));
    const patternHit = (rule.patterns ?? []).some((p) => p.test(text));

    if (triggers.length > 0 || patternHit) {
      return { intent: rule.intent, triggers };
    }
  }
  return { intent: "search", triggers: [] };
}

/** รับรู้จำนวนจาก "2 ชิ้น" / "สองอัน" / เลขไทย และเลขที่ยืนเดี่ยว ๆ */
function parseQuantity(text: string): { quantity: number; rest: string } {
  let rest = text;
  let quantity = 0;

  const digitMatch = rest.match(
    new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:${UNITS})?(?=\\s|$)`, "i"),
  );
  if (digitMatch) {
    const value = toNumber(digitMatch[1]);
    if (value > 0 && value <= 20) {
      quantity = value;
      rest = rest.replace(digitMatch[0], " ");
    }
  }

  if (quantity === 0) {
    for (const [word, value] of Object.entries(THAI_NUMBERS)) {
      const pair = rest.match(new RegExp(`(?:^|\\s)(${word})\\s*(?:${UNITS})?(?=\\s|$)`));
      if (pair) {
        quantity = value;
        rest = rest.replace(pair[0], " ");
        break;
      }
    }
  }

  return { quantity, rest };
}

function parseBudget(text: string): { budget: Budget; rest: string } {
  let rest = text;
  const budget: Budget = {};

  const maxMatch = rest.match(BUDGET_PATTERNS.max);
  if (maxMatch) {
    budget.max = toNumber(maxMatch[1]);
    rest = rest.replace(maxMatch[0], " ");
  }

  const minMatch = rest.match(BUDGET_PATTERNS.min);
  if (minMatch) {
    budget.min = toNumber(minMatch[1]);
    rest = rest.replace(minMatch[0], " ");
  }

  return { budget, rest };
}

/**
 * หมวดสินค้าใช้เป็นตัวกรองเท่านั้น ไม่ลบคำออกจากคำค้น
 * เพราะภาษาไทยไม่มีช่องว่างระหว่างคำ การตัดทิ้งจะทำให้เสียความหมาย
 */
function parseCategory(text: string): Category | undefined {
  const entries = Object.entries(CATEGORY_WORDS).sort((a, b) => b[0].length - a[0].length);
  return entries.find(([word]) => text.includes(word))?.[1];
}

function parseSort(text: string): { sort: SortKey; rest: string } {
  let rest = text;
  let sort: SortKey = "relevance";

  for (const rule of SORT_WORDS) {
    const hit = rule.triggers.find((t) => rest.includes(t));
    if (hit) {
      sort = rule.sort;
      rest = rest.replace(hit, " ");
      break;
    }
  }

  return { sort, rest };
}

/** ตัดคำสั่งและคำเติมออก เหลือแต่คำค้นสินค้า */
function buildQuery(text: string, triggers: string[]): string {
  let rest = text;

  for (const trigger of triggers) {
    if (trigger) rest = rest.replaceAll(trigger, " ");
  }

  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);
  for (const filler of sortedFillers) {
    if (rest.includes(filler)) rest = rest.replaceAll(filler, " ");
  }

  return rest.replace(/\s+/g, " ").trim();
}

function scoreConfidence(intent: Intent, query: string, hadTrigger: boolean): number {
  if (intent === "search" && !hadTrigger) return query.length >= 2 ? 0.55 : 0.2;
  if (intent === "search") return Math.min(0.9, 0.6 + query.length * 0.05);
  if (intent === "greeting" || intent === "help") return 0.95;
  return 0.85;
}

export function parseCommand(input: string): ParsedCommand {
  const normalized = normalize(input);
  const { intent, triggers } = findIntent(normalized);

  // งบต้องมาก่อนจำนวน มิฉะนั้นเลขราคาจะถูกกินไปเป็นจำนวนสินค้า
  const budgetStep = parseBudget(normalized);
  const quantityStep = parseQuantity(budgetStep.rest);
  const sortStep = parseSort(quantityStep.rest);
  const category = parseCategory(normalized);

  const query = buildQuery(sortStep.rest, triggers);

  return {
    raw: input.trim(),
    intent,
    query,
    quantity: intent === "add" ? Math.max(1, quantityStep.quantity) : quantityStep.quantity,
    category,
    budget: budgetStep.budget,
    sort: sortStep.sort,
    confidence: scoreConfidence(intent, query, triggers.length > 0),
  };
}
