"use client";

import { formatTHB } from "@/src/lib/catalog";
import type { Product } from "@/src/lib/types";

type Props = {
  product: Product;
  reasons?: string[];
  onAdd: (product: Product) => void;
};

function stockLabel(stock: number) {
  if (stock === 0) return { text: "หมดชั่วคราว", tone: "text-coral-400 border-coral-400/40 bg-coral-400/10" };
  if (stock <= 5) return { text: `เหลือ ${stock} ชิ้น`, tone: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  return { text: "พร้อมส่ง", tone: "text-mint-400 border-mint-400/40 bg-mint-400/10" };
}

export function ProductCard({ product, reasons = [], onAdd }: Props) {
  const stock = stockLabel(product.stock);
  const discount =
    product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  return (
    <article className="glass animate-rise flex flex-col gap-3 rounded-2xl p-4 transition hover:border-brand-500/50 hover:shadow-[0_0_0_1px_var(--color-brand-500)]">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-xl bg-ink-800 text-2xl ring-1 ring-ink-600"
        >
          {product.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-brand-300 uppercase">{product.brand}</p>
          <h3 className="truncate text-base font-semibold text-white" title={product.name}>
            {product.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            ★ {product.rating.toFixed(1)} · {product.reviewCount} รีวิว
          </p>
        </div>

        {discount > 0 && (
          <span className="shrink-0 rounded-full bg-brand-600/20 px-2 py-0.5 text-xs font-semibold text-brand-300">
            -{discount}%
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-sm text-slate-300">{product.description}</p>

      <ul className="space-y-1 text-xs text-slate-400">
        {product.features.slice(0, 2).map((feature) => (
          <li key={feature} className="flex gap-1.5">
            <span aria-hidden className="text-mint-400">
              ✓
            </span>
            <span className="line-clamp-1">{feature}</span>
          </li>
        ))}
      </ul>

      {reasons.length > 0 && (
        <p className="rounded-lg bg-brand-500/10 px-2 py-1 text-[11px] text-brand-300">
          ตรงเพราะ {reasons.join(", ")}
        </p>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink-700 pt-3">
        <div>
          <p className="text-lg font-bold text-white">{formatTHB(product.price)}</p>
          {product.originalPrice > product.price && (
            <p className="text-xs text-slate-500 line-through">{formatTHB(product.originalPrice)}</p>
          )}
          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${stock.tone}`}>
            {stock.text}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAdd(product)}
          disabled={product.stock === 0}
          className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-slate-500"
        >
          {product.stock === 0 ? "ไม่มีของ" : "+ เพิ่มลงตะกร้า"}
        </button>
      </div>
    </article>
  );
}
