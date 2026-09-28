import { catalog } from "./catalog";
import { getPool, isDatabaseConfigured, type ProductRow } from "./db";
import { pickBestTarget, rankProducts, withinBudget } from "./matching";
import type { Budget, Category, ParsedCommand, Product, ProductMatch, SortKey } from "./types";

/**
 * ชั้นเข้าถึงข้อมูลสินค้า
 *
 * หลักการ:
 * - ฐานข้อมูล (MySQL) ทำหน้าที่ "กรอง" ด้วยคอลัมน์ที่มีดัชนี (หมวด, ช่วงราคา)
 * - ชั้น Node ทำหน้าที่ "ให้คะแนนและจัดอันดับ" ด้วย fuzzy matching ภาษาไทย
 * - ถ้าเชื่อมต่อ MySQL ไม่ได้ ระบบ fallback ไปใช้ products.json โดยอัตโนมัติ
 *   ทำให้ทั้งสองเส้นทางให้ผลลัพธ์เดียวกันเสมอ
 */

/** เพดานจำนวนแถวที่ดึงมาให้คะแนน ป้องกันฐานข้อมูลใหญ่ทำให้ process ค้าง */
const MAX_CANDIDATES = 500;

export type DataSource = "database" | "json";

export type SearchResult = {
  matches: ProductMatch[];
  /** จำนวนที่เจอทั้งหมด ก่อนตัดตาม limit */
  total: number;
  source: DataSource;
};

type CandidateFilter = {
  category?: Category;
  budget: Budget;
  limit?: number;
};

function toProduct(row: ProductRow): Product {
  const parseList = (value: string | string[]): string[] => {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const releasedAt = row.released_at instanceof Date ? row.released_at.toISOString().slice(0, 10) : String(row.released_at);

  return {
    id: String(row.id),
    name: String(row.name),
    brand: String(row.brand),
    category: row.category as Category,
    price: Number(row.price),
    originalPrice: Number(row.original_price ?? 0),
    stock: Number(row.stock ?? 0),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    releasedAt,
    emoji: String(row.emoji ?? ""),
    keywords: parseList(row.keywords),
    description: String(row.description ?? ""),
    features: parseList(row.features),
  };
}

async function fetchFromDatabase(filter: CandidateFilter): Promise<Product[] | null> {
  const pool = getPool();
  if (!pool) return null;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.category) {
    conditions.push("category = ?");
    params.push(filter.category);
  }
  if (filter.budget.min !== undefined) {
    conditions.push("price >= ?");
    params.push(filter.budget.min);
  }
  if (filter.budget.max !== undefined) {
    conditions.push("price <= ?");
    params.push(filter.budget.max);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filter.limit ?? MAX_CANDIDATES, MAX_CANDIDATES);

  const [rows] = await pool.query<ProductRow[]>(
    `SELECT id, name, brand, category, price, original_price, stock, rating, review_count,
            released_at, emoji, keywords, description, features
       FROM products
       ${where}
      LIMIT ?`,
    [...params, limit],
  );

  return rows.map(toProduct);
}

function fetchFromJson(filter: CandidateFilter): Product[] {
  return catalog.filter(
    (product) =>
      (filter.category ? product.category === filter.category : true) && withinBudget(product.price, filter.budget),
  );
}

/** ดึงสินค้าที่ผ่านเงื่อนไข พร้อมบอกว่ามาจากแหล่งไหน */
export async function fetchCandidates(filter: CandidateFilter): Promise<{ products: Product[]; source: DataSource }> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await fetchFromDatabase(filter);
      if (rows) return { products: rows, source: "database" };
    } catch (error) {
      // ต่อฐานข้อมูลไม่ได้ ไม่ควรทำให้ทั้งระบบล่ม — ถอยไปใช้ JSON แทน
      console.error("[repository] MySQL ใช้งานไม่ได้ ใช้ข้อมูลจาก JSON แทน:", error instanceof Error ? error.message : error);
    }
  }

  return { products: fetchFromJson(filter), source: "json" };
}

/** ค้นหาสินค้าตามคำสั่งที่ผ่านการตีความแล้ว */
export async function searchProducts(command: ParsedCommand, limit = 8): Promise<SearchResult> {
  const { products, source } = await fetchCandidates({
    category: command.category,
    budget: command.budget,
    limit: MAX_CANDIDATES,
  });

  const ranked = rankProducts(products, {
    query: command.query,
    category: command.category,
    sort: command.sort as SortKey,
    limit: MAX_CANDIDATES,
  });

  return { matches: ranked.slice(0, limit), total: ranked.length, source };
}

/** หาสินค้าที่ผู้ใช้ตั้งใจสั่งซื้อ/สั่งลบ — คืน null เมื่อไม่มั่นใจพอ */
export async function resolveTarget(
  query: string,
): Promise<{ match: ProductMatch; source: DataSource } | null> {
  const { products, source } = await fetchCandidates({ budget: {}, limit: MAX_CANDIDATES });
  const match = pickBestTarget(query, products);
  return match ? { match, source } : null;
}

/** รายการสินค้าทั้งหมด สำหรับหน้าแสดงผลและ API จัดการข้อมูล */
export async function listProducts(): Promise<{ products: Product[]; source: DataSource }> {
  return fetchCandidates({ budget: {}, limit: MAX_CANDIDATES });
}
