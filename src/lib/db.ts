import type { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";

/**
 * การเชื่อมต่อ MySQL
 *
 * ถ้าไม่ได้ตั้ง DATABASE_URL ระบบจะไม่สร้าง connection ใด ๆ
 * และชั้นข้อมูลจะ fallback ไปใช้ src/data/products.json แทน
 * ทำให้รันโปรเจกต์ได้แม้ไม่มีฐานข้อมูล
 */

const CONNECTION_LIMIT = 10;

type Pool = mysql.Pool;

declare global {
  var __shopvoicePool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** คืน pool ถ้าตั้งค่าไว้แล้ว ไม่งั้นคืน null */
export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (globalThis.__shopvoicePool) return globalThis.__shopvoicePool;

  const pool = mysql.createPool({
    uri: url,
    connectionLimit: CONNECTION_LIMIT,
    waitForConnections: true,
    enableKeepAlive: true,
    // แปลง DECIMAL/JSON ให้เป็นค่า JS ที่ใช้งานได้ทันที
    decimalNumbers: true,
    // คืน DATE เป็นสตริง 'YYYY-MM-DD' ตรง ๆ ไม่ผ่าน timezone
    // ป้องกันวันที่คลาดไปหนึ่งวันตอนแปลงเป็น Date
    dateStrings: ["DATE"],
    charset: "utf8mb4_unicode_ci",
  });

  // การเชื่อมต่อหลุดเป็นเรื่องปกติของ MySQL ไม่ควรทำให้ process ล้ม
  // ต้องผูกกับ pool ฝั่ง callback เพราะ promise pool ไม่ emit event "error"
  pool.pool.on("error", (error: Error) => {
    console.error("[db] connection error:", error.message);
  });

  globalThis.__shopvoicePool = pool;
  return pool;
}

/** ปิด pool — ใช้ตอนปิด server หรือในเทสต์ */
export async function closePool(): Promise<void> {
  const pool = globalThis.__shopvoicePool;
  if (!pool) return;
  await pool.end();
  globalThis.__shopvoicePool = undefined;
}

export type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number;
  stock: number;
  rating: number;
  review_count: number;
  released_at: string | Date;
  emoji: string;
  keywords: string | string[];
  description: string;
  features: string | string[];
};
