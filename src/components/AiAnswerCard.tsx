"use client";

import type { AiAnswer } from "@/src/lib/types";

type Props = {
  answer: AiAnswer;
};

/** การ์ดคำตอบจาก AI ที่แสดงเมื่อค้นไม่เจอสินค้าในฐานข้อมูล */
export function AiAnswerCard({ answer }: Props) {
  return (
    <section
      aria-label="คำตอบจาก AI"
      className="glass animate-rise flex flex-col gap-3 rounded-2xl border-brand-500/30 p-4"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          🤖
        </span>
        <h2 className="text-sm font-semibold text-white">AI ช่วยตอบแทน</h2>
        <span className="ml-auto shrink-0 rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-300">
          n8n + Groq
        </span>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-line text-slate-200">{answer.answer}</p>

      <p className="border-t border-ink-700 pt-2 text-[11px] text-slate-500">
        ไม่พบสินค้านี้ในฐานข้อมูล จึงส่งคำถามให้ n8n เรียก Groq ตอบแทน — AI
        ไม่มีสิทธิ์เข้าถึงฐานข้อมูล จึงไม่อ้างราคาหรือสต็อกที่ไม่มีจริง
      </p>
    </section>
  );
}
