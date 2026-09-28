import type { AnswerSource } from "@/src/lib/types";

const STYLES: Record<Exclude<AnswerSource, "none">, { label: string; tone: string }> = {
  database: { label: "จาก MySQL", tone: "text-mint-400 border-mint-400/40 bg-mint-400/10" },
  json: { label: "จากข้อมูลตัวอย่าง (JSON)", tone: "text-slate-400 border-ink-600 bg-ink-800" },
  ai: { label: "AI ผ่าน n8n + Groq", tone: "text-brand-300 border-brand-500/40 bg-brand-500/10" },
};

type Props = {
  source: AnswerSource;
};

/** ป้ายบอกว่าคำตอบนี้มาจากไหน — ฐานข้อมูล, ข้อมูลสำรอง, หรือ AI */
export function SourceBadge({ source }: Props) {
  const style = STYLES[source as Exclude<AnswerSource, "none">];
  if (!style) return null;

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.tone}`}>
      {style.label}
    </span>
  );
}
