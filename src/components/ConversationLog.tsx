"use client";

import { useEffect, useRef } from "react";
import type { Product } from "@/src/lib/types";

export type LogEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: Product[];
};

type Props = {
  entries: LogEntry[];
};

export function ConversationLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="glass rounded-2xl p-4 text-center text-sm text-slate-400">
        ยังไม่มีคำสั่ง ลองกดไมโครโฟนแล้วพูดชื่อสินค้าที่ต้องการ หรือพิมพ์ด้านล่าง
      </p>
    );
  }

  return (
    <ol className="no-scrollbar max-h-72 space-y-2 overflow-y-auto" aria-live="polite">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={`animate-rise flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              entry.role === "user"
                ? "bg-brand-600 text-white"
                : "glass text-slate-200"
            }`}
          >
            {entry.text}
            {entry.products && entry.products.length > 0 && (
              <p className="mt-1 text-xs opacity-80">
                {entry.products.map((p) => p.name).join(" · ")}
              </p>
            )}
          </div>
        </li>
      ))}
      <div ref={bottomRef} />
    </ol>
  );
}
