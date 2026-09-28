import productsData from "@/src/data/products.json";
import { normalize } from "./nlu";
import type { Category, ParsedCommand, Product, ProductMatch, SortKey } from "./types";

export const catalog = productsData as Product[];

export const CATEGORY_LABELS: Record<Category, string> = {
  audio: "เสียง",
  computer: "คอมพิวเตอร์",
  display: "จอภาพ",
  laptop: "โน้ตบุ๊ก",
  tablet: "แท็บเล็ต",
  wearable: "นาฬิกาอัจฉริยะ",
  accessory: "อุปกรณ์เสริม",
  storage: "สตอเรจ",
  appliance: "เครื่องใช้ไฟฟ้า",
};

export const formatTHB = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);

/** Dice coefficient บน bigram ตัวอักษร — รองรับภาษาไทยที่ไม่มีช่องว่างระหว่างคำ */
function bigrams(value: string): Set<string> {
  const chars = Array.from(value.replace(/\s+/g, ""));
  const pairs = new Set<string>();
  if (chars.length === 1) return new Set([chars[0]]);

  for (let i = 0; i < chars.length - 1; i += 1) {
    pairs.add(chars[i] + chars[i + 1]);
  }
  return pairs;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  left.forEach((pair) => {
    if (right.has(pair)) shared += 1;
  });

  return (2 * shared) / (left.size + right.size);
}

type TermScore = { score: number; reason?: string };

/** หาสัญญาณที่แรงที่สุดของคำค้นหนึ่งคำเมื่อเทียบกับสินค้าหนึ่งรายการ */
function scoreTerm(term: string, product: Product, name: string, brand: string, keywords: string[]): TermScore {
  if (name === term) return { score: 40, reason: `ชื่อตรงกับ "${term}"` };
  if (brand === term) return { score: 30, reason: `ตรงกับแบรนด์ ${product.brand}` };

  if (keywords.includes(term)) {
    const keyword = product.keywords[keywords.indexOf(term)];
    return { score: 30, reason: `ตรงกับคำสำคัญ "${keyword}"` };
  }

  let best: TermScore = { score: 0 };

  if (name.includes(term)) best = { score: 25, reason: `ชื่อสินค้ามี "${term}"` };

  if (best.score < 20) {
    for (const [index, keyword] of keywords.entries()) {
      if (keyword.includes(term) || term.includes(keyword)) {
        best = { score: 18, reason: `"${product.keywords[index]}" สอดคล้องกับ "${term}"` };
        break;
      }
    }
  }

  if (best.score === 0) {
    const candidates = [name, ...keywords];
    for (const candidate of candidates) {
      const ratio = similarity(term, candidate);
      if (ratio >= 0.75) return { score: 45, reason: "ใกล้เคียงมาก (รองรับคำพิมพ์ผิด)" };
      if (ratio >= 0.6 && best.score < 20) {
        best = { score: 20, reason: "ใกล้เคียงคำค้น (รองรับคำพิมพ์ผิด)" };
      }
    }
  }

  return best;
}

function scoreProduct(query: string, product: Product): { score: number; reasons: string[] } {
  if (!query) return { score: 0, reasons: [] };

  const name = normalize(product.name);
  const brand = normalize(product.brand);
  const keywords = product.keywords.map(normalize);
  const terms = query.split(" ").filter(Boolean);
  const reasons: string[] = [];

  let score = 0;
  for (const term of terms) {
    const termScore = scoreTerm(term, product, name, brand, keywords);
    score += termScore.score;
    if (termScore.reason && !reasons.includes(termScore.reason)) reasons.push(termScore.reason);
  }

  // โบนัสเมื่อคำค้นทั้งวลีไปตรงกับชื่อสินค้า เช่น "หูฟัง tws pro"
  if (terms.length > 1 && name.includes(query)) {
    score += 50;
    reasons.unshift("ชื่อสินค้าตรงกับคำค้น");
  }

  return { score, reasons: reasons.slice(0, 2) };
}

const SORTERS: Record<SortKey, (a: ProductMatch, b: ProductMatch) => number> = {
  relevance: (a, b) => b.score - a.score || b.product.rating - a.product.rating,
  price_asc: (a, b) => a.product.price - b.product.price,
  price_desc: (a, b) => b.product.price - a.product.price,
  rating: (a, b) => b.product.rating - a.product.rating || b.product.reviewCount - a.product.reviewCount,
  newest: (a, b) => b.product.releasedAt.localeCompare(a.product.releasedAt),
};

export function searchProducts(command: ParsedCommand, limit = 8): ProductMatch[] {
  const { query, category, budget, sort } = command;
  const browseAll = query.length === 0;

  const matches = catalog
    .filter((product) => (category ? product.category === category : true))
    .filter(
      (product) =>
        (budget.min === undefined || product.price >= budget.min) &&
        (budget.max === undefined || product.price <= budget.max),
    )
    .map((product) => {
      const { score, reasons } = scoreProduct(query, product);

      if (score > 0) return { product, score, reasons };
      if (category) {
        return { product, score: 10, reasons: [`อยู่ในหมวด${CATEGORY_LABELS[category]}`] };
      }
      return { product, score: 0, reasons: [] };
    })
    .filter((match) => browseAll || match.score > 0)
    .sort((a, b) => SORTERS[sort](a, b));

  return matches.slice(0, limit);
}

const MIN_TARGET_SCORE = 40;

/** หาสินค้าที่ผู้ใช้ตั้งใจจะสั่งซื้อ/สั่งลบ — คืน null ถ้าไม่มั่นใจพอ */
export function resolveTarget(query: string): ProductMatch | null {
  const command: ParsedCommand = {
    raw: query,
    intent: "add",
    query: normalize(query),
    quantity: 1,
    budget: {},
    sort: "relevance",
    confidence: 0,
  };

  const [best] = searchProducts(command, 1);
  return best && best.score >= MIN_TARGET_SCORE ? best : null;
}

export const SAMPLE_COMMANDS = [
  "อยากได้หูฟังไร้สาย",
  "หาคีย์บอร์ดราคาไม่เกิน 4000",
  "จอคอม 4k ราคาถูก",
  "เพิ่มหูฟัง TWS Pro ลงตะกร้า 2 ชิ้น",
  "เอาหูฟัง TWS Pro ออก",
  "ดูตะกร้า",
  "สรุปราคา",
];
