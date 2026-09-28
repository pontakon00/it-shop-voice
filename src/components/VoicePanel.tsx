"use client";

import type { SpeechStatus } from "@/src/hooks/useSpeechRecognition";

type Props = {
  status: SpeechStatus;
  busy: boolean;
  interim: string;
  error: string | null;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
};

const STATUS_TEXT: Record<SpeechStatus, string> = {
  idle: "พร้อมรับคำสั่งเสียง",
  listening: "กำลังฟัง… พูดได้เลย",
  processing: "กำลังประมวลผลคำสั่ง…",
  error: "เกิดข้อผิดพลาด",
};

export function VoicePanel({ status, busy, interim, error, supported, onStart, onStop }: Props) {
  const listening = status === "listening";
  const working = busy || status === "processing";

  return (
    <section className="glass relative overflow-hidden rounded-3xl p-6 text-center sm:p-8">
      <div className="flex flex-col items-center gap-5">
        <div className="relative grid place-items-center">
          {listening && (
            <>
              <span aria-hidden className="animate-ring absolute size-28 rounded-full bg-brand-500/40" />
              <span aria-hidden className="animate-ring absolute size-28 rounded-full bg-brand-400/30 [animation-delay:0.6s]" />
            </>
          )}

          <button
            type="button"
            onClick={listening ? onStop : onStart}
            disabled={!supported || working}
            aria-pressed={listening}
            aria-label={listening ? "หยุดฟัง" : "เริ่มพูดคำสั่ง"}
            className={`grid size-28 place-items-center rounded-full text-4xl transition
              ${listening ? "bg-coral-400 text-ink-950" : "bg-brand-500 text-white hover:bg-brand-400"}
              disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-slate-500`}
          >
            {working ? (
              <span
                aria-hidden
                className="size-7 animate-spin rounded-full border-[3px] border-current border-t-transparent"
              />
            ) : listening ? (
              <span aria-hidden>⏹</span>
            ) : (
              <span aria-hidden>🎤</span>
            )}
          </button>
        </div>

        <div>
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-200">
            <span
              aria-hidden
              className={`size-2 rounded-full ${
                listening ? "animate-pulse bg-coral-400" : working ? "bg-amber-400" : "bg-mint-400"
              }`}
            />
            {!supported ? "เบราว์เซอร์นี้ไม่รองรับการตัดเสียง" : STATUS_TEXT[status]}
          </p>

          {interim && (
            <p className="mt-2 text-lg text-brand-300 italic">
              “{interim}
              <span aria-hidden className="ml-0.5 inline-block w-0.5 animate-pulse bg-current align-middle" />
              ”
            </p>
          )}

          {error && <p className="mt-2 text-sm text-coral-400">{error}</p>}

          {!supported && (
            <p className="mt-2 text-sm text-amber-400">
              แนะนำใช้ Chrome หรือ Edge หรือพิมพ์คำสั่งด้านล่างแทน
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
