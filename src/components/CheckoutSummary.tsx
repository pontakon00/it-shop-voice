"use client";

import { formatTHB } from "@/src/lib/catalog";
import type { CartLine } from "@/src/lib/types";

type Totals = { itemCount: number; subtotal: number; shipping: number; total: number };

type Props = {
  open: boolean;
  lines: CartLine[];
  totals: Totals;
  onClose: () => void;
  onConfirm: () => void;
};

export function CheckoutSummary({ open, lines, totals, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="สรุปคำสั่งซื้อ"
        className="animate-rise glass relative w-full max-w-md rounded-2xl p-5"
      >
        <h2 className="text-lg font-semibold text-white">สรุปคำสั่งซื้อ</h2>

        <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
          {lines.map((line) => (
            <li key={line.product.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-300">
                {line.product.emoji} {line.product.name} × {line.quantity}
              </span>
              <span className="shrink-0 text-slate-200">
                {formatTHB(line.product.price * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-ink-700 pt-3 text-sm">
          <div className="flex justify-between text-slate-400">
            <dt>รวม {totals.itemCount} ชิ้น</dt>
            <dd>{formatTHB(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-400">
            <dt>ค่าจัดส่ง</dt>
            <dd>{totals.shipping === 0 ? "ฟรี" : formatTHB(totals.shipping)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-lg font-bold text-white">
            <dt>ยอดชำระ</dt>
            <dd>{formatTHB(totals.total)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-amber-400">
          * ระบบนี้เป็นโปรเจกต์สาธิต ยังไม่ได้เชื่อมต่อเกตเวย์จริง
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink-600 py-2.5 text-sm text-slate-300 transition hover:bg-ink-800"
          >
            กลับไปดูตะกร้า
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-mint-400 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-110"
          >
            ยืนยันคำสั่งซื้อ
          </button>
        </div>
      </div>
    </div>
  );
}
