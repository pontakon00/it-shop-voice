export type Category =
  | "audio"
  | "computer"
  | "display"
  | "laptop"
  | "tablet"
  | "wearable"
  | "accessory"
  | "storage"
  | "appliance";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  originalPrice: number;
  stock: number;
  rating: number;
  reviewCount: number;
  releasedAt: string;
  emoji: string;
  keywords: string[];
  description: string;
  features: string[];
};

export type SortKey = "relevance" | "price_asc" | "price_desc" | "rating" | "newest";

export type Intent =
  | "search"
  | "add"
  | "remove"
  | "clear"
  | "cart"
  | "checkout"
  | "help"
  | "greeting"
  | "unknown";

export type Budget = { min?: number; max?: number };

export type ParsedCommand = {
  raw: string;
  intent: Intent;
  query: string;
  quantity: number;
  category?: Category;
  budget: Budget;
  sort: SortKey;
  confidence: number;
};

export type MatchReason = string;

export type ProductMatch = {
  product: Product;
  score: number;
  reasons: MatchReason[];
};

export type CartLine = {
  product: Product;
  quantity: number;
};

/** ผลลัพธ์มาจากสินค้าในฐานข้อมูล หรือถูก AI ตอบแทนเมื่อค้นไม่เจอ */
export type AnswerSource = "database" | "json" | "ai" | "none";

export type AiAnswer = {
  answer: string;
  suggestions: string[];
};

export type VoiceResponse = {
  transcript: string;
  intent: Intent;
  reply: string;
  confidence: number;
  query: string;
  quantity: number;
  budget: Budget;
  sort: SortKey;
  results: ProductMatch[];
  totalResults: number;
  suggestion: string[];
  /** แหล่งที่มาของคำตอบ — ใช้แสดงป้ายในหน้าเว็บ */
  source: AnswerSource;
  /** มีเฉพาะเมื่อ source เป็น "ai" */
  aiAnswer?: AiAnswer;
};
