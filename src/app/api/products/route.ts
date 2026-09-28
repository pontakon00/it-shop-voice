import { NextResponse } from "next/server";
import { listProducts } from "@/src/lib/productRepository";

/**
 * GET /api/products — รายการสินค้าทั้งหมด
 *
 * อ่านจาก MySQL ถ้าเชื่อมต่อได้ มิฉะนั้นใช้ products.json
 * ตอบกลับบอกแหล่งที่มาด้วย เพื่อให้ตรวจสอบได้ว่าอยู่เส้นทางไหน
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { products, source } = await listProducts();

    return NextResponse.json({
      source,
      total: products.length,
      products,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "อ่านข้อมูลสินค้าไม่สำเร็จ", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
