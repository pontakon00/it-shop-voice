"use client";

import { useEffect } from "react";
import { formatTHB } from "@/src/lib/catalog";
import { FREE_SHIPPING_THRESHOLD, MAX_QUANTITY } from "@/src/hooks/useCart";
import type { CartLine } from "@/src/lib/types";

type Totals = { itemCount: number; subtotal: number; shipping: number; total: number };

type Props = {
  open: boolean;
  lines: CartLine[];
  totals: Totals;
  onClose: () => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
};

export function CartDrawer({ open, lines, totals, onClose, onSetQuantity, onRemove, onCheckout }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="ปิดตะกร้า"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="ตะกร้าสินค้า"
        className="animate-rise relative flex h-full w-full max-w-sm flex-col border-l border-ink-700 bg-ink-900"
      >
        <header className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <h2 className="font-semibold text-white">ตะกร้าสินค้า ({totals.itemCount})</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-ink-800 hover:text-white"
          >
            ✕
          </button>
        </header>

        {lines.length === 0 ? (
          <p className="flex-1 place-items-center p-8 text-center text-sm text-slate-400">
            ยังไม่มีสินค้าในตะกร้า
            <br />
            พูดว่า “เพิ่มหูฟัง TWS Pro ลงตะกร้า” เพื่อเริ่มสั่งซื้อ
          </p>
        ) : (
          <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.map((line) => (
              <li key={line.product.id} className="flex gap-3 rounded-xl bg-ink-850/70 p-3">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-800 text-xl">
                  {line.product.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{line.product.name}</p>
                  <p className="text-xs text-slate-400">{formatTHB(line.product.price)}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-ink-600">
                      <button
                        type="button"
                        aria-label={`ลดจำนวน ${line.product.name}`}
                        onClick={() => onSetQuantity(line.product.id, line.quantity - 1)}
                        className="px-2 py-0.5 text-slate-300 transition hover:text-white"
                      >
                        −
                      </button>
                      <span className="min-w-7 text-center text-sm text-white">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`เพิ่มจำนวน ${line.product.name}`}
                        onClick={() => onSetQuantity(line.product.id, line.quantity + 1)}
                        disabled={line.quantity >= MAX_QUANTITY || line.quantity >= line.product.stock}
                        className="px-2 py-0.5 text-slate-300 transition hover:text-white disabled:text-ink-600"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(line.product.id)}
                      className="text-xs text-coral-400 transition hover:underline"
                    >
                      ลบ
                    </button>
                  </div>
                </div>

                <p className="shrink-0 text-sm font-semibold text-white">
                  {formatTHB(line.product.price * line.quantity)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <footer className="space-y-2 border-t border-ink-700 px-4 py-4 text-sm">
          <Row label="สินค้ารวม" value={formatTHB(totals.subtotal)} />
          <Row
            label="ค่าจัดส่ง"
            value={totals.shipping === 0 ? "ฟรี" : formatTHB(totals.shipping)}
            hint={totals.shipping > 0 ? `ซื้อครบ ${formatTHB(FREE_SHIPPING_THRESHOLD)} ส่งฟรี` : undefined}
          />
          <div className="flex items-center justify-between border-t border-ink-700 pt-2 text-base font-bold text-white">
            <span>รวมทั้งสิ้น</span>
            <span>{formatTHB(totals.total)}</span>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={lines.length === 0}
            className="mt-2 w-full rounded-xl bg-brand-500 py-2.5 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-slate-500"
          >
            สรุปคำสั่งซื้อ
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between text-slate-300">
      <span>
        {label}
        {hint && <span className="ml-1 text-[11px] text-slate-500">({hint})</span>}
      </span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
