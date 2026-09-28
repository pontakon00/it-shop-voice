import productsData from "@/src/data/products.json";
import type { Product } from "./types";

export { CATEGORY_LABELS } from "./matching";

/** ข้อมูลสินค้าสำรอง ใช้เมื่อไม่ได้เชื่อมต่อ MySQL */
export const catalog = productsData as Product[];

export const formatTHB = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);

export const SAMPLE_COMMANDS = [
  "อยากได้หูฟังไร้สาย",
  "หาคีย์บอร์ดราคาไม่เกิน 4000",
  "จอคอม 4k ราคาถูก",
  "เพิ่มหูฟัง TWS Pro ลงตะกร้า 2 ชิ้น",
  "เอาหูฟัง TWS Pro ออก",
  "ดูตะกร้า",
  "สรุปราคา",
];
