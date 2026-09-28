"use client";

import { useCallback, useRef, useState } from "react";
import { AiAnswerCard } from "@/src/components/AiAnswerCard";
import { CartDrawer } from "@/src/components/CartDrawer";
import { CheckoutSummary } from "@/src/components/CheckoutSummary";
import { ConversationLog, type LogEntry } from "@/src/components/ConversationLog";
import { ProductCard } from "@/src/components/ProductCard";
import { SourceBadge } from "@/src/components/SourceBadge";
import { SuggestionChips } from "@/src/components/SuggestionChips";
import { VoicePanel } from "@/src/components/VoicePanel";
import { SAMPLE_COMMANDS } from "@/src/lib/catalog";
import { useCart } from "@/src/hooks/useCart";
import { useSpeechRecognition } from "@/src/hooks/useSpeechRecognition";
import type { AiAnswer, AnswerSource, Product, ProductMatch, VoiceResponse } from "@/src/lib/types";

export default function Home() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [answerSource, setAnswerSource] = useState<AnswerSource>("none");
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(SAMPLE_COMMANDS);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const cart = useCart();
  const busyRef = useRef(false);
  const idRef = useRef(0);

  const pushEntry = useCallback((role: LogEntry["role"], text: string, products?: Product[]) => {
    idRef.current += 1;
    setEntries((current) => [...current, { id: `e${idRef.current}`, role, text, products }]);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const handleResponse = useCallback(
    (data: VoiceResponse) => {
      const [first] = data.results;
      setAnswerSource(data.source);
      setAiAnswer(data.aiAnswer ?? null);

      switch (data.intent) {
        case "search":
          setMatches(data.results);
          break;

        case "add":
          if (!first) break;
          if (first.product.stock === 0) {
            pushEntry("assistant", `ขออภัย ${first.product.name} หมดสต็อกอยู่ตอนนี้ครับ`);
            break;
          }
          cart.add(first.product, data.quantity);
          notify(`เพิ่ม ${first.product.name} × ${data.quantity} ลงตะกร้าแล้ว`);
          break;

        case "remove":
          if (!first) break;
          cart.remove(first.product.id);
          notify(`ลบ ${first.product.name} ออกจากตะกร้าแล้ว`);
          break;

        case "clear":
          cart.clear();
          notify("ล้างตะกร้าเรียบร้อย");
          break;

        case "cart":
          setCartOpen(true);
          break;

        case "checkout":
          setCheckoutOpen(true);
          break;

        default:
          setMatches([]);
      }
    },
    [cart, notify, pushEntry],
  );

  const runCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;

      busyRef.current = true;
      setBusy(true);
      pushEntry("user", text);

      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = (await response.json()) as VoiceResponse;
        handleResponse(data);
        pushEntry("assistant", data.reply, data.results.slice(0, 3).map((m) => m.product));
        setSuggestions(data.suggestion);
      } catch {
        pushEntry("assistant", "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setSuggestions(SAMPLE_COMMANDS.slice(0, 3));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [handleResponse, pushEntry],
  );

  const speech = useSpeechRecognition({
    onFinal: (transcript) => runCommand(transcript),
  });

  const handleQuickAdd = useCallback(
    (product: Product) => {
      if (product.stock === 0) {
        notify(`${product.name} หมดสต็อก`);
        return;
      }
      cart.add(product, 1);
      notify(`เพิ่ม ${product.name} ลงตะกร้าแล้ว`);
    },
    [cart, notify],
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            🛍️ ShopVoice
          </h1>
          <p className="text-xs text-slate-400 sm:text-sm">
            ช้อปปิ้งออนไลน์ด้วยคำสั่งเสียง — พูด ก็ได้ พิมพ์ ก็ได้
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="glass relative rounded-xl px-3.5 py-2 text-sm text-slate-200 transition hover:border-brand-500 hover:text-white"
        >
          🛒 ตะกร้า
          {cart.totals.itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
              {cart.totals.itemCount}
            </span>
          )}
        </button>
      </header>

      <VoicePanel
        status={speech.status}
        busy={busy}
        interim={speech.interim}
        error={speech.error}
        supported={speech.supported}
        onStart={speech.start}
        onStop={speech.stop}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft;
          setDraft("");
          void runCommand(value);
        }}
        className="flex gap-2"
      >
        <label htmlFor="command" className="sr-only">
          พิมพ์คำสั่ง
        </label>
        <input
          id="command"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="พิมพ์คำสั่ง เช่น หาหูฟังราคาไม่เกิน 3000"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-850/70 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-slate-500"
        >
          ส่ง
        </button>
      </form>

      <SuggestionChips items={suggestions} onPick={runCommand} disabled={busy} />

      <ConversationLog entries={entries} />

      {aiAnswer && <AiAnswerCard answer={aiAnswer} />}

      {matches.length > 0 && (
        <section aria-label="ผลการค้นหา" className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-300">ผลการค้นหา ({matches.length})</h2>
            <SourceBadge source={answerSource} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((match) => (
              <ProductCard
                key={match.product.id}
                product={match.product}
                reasons={match.reasons}
                onAdd={handleQuickAdd}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-2 text-center text-xs text-slate-500">
        Next.js 16 · React 19 · TypeScript · MySQL · n8n · Groq AI · Web Speech API
      </footer>

      <CartDrawer
        open={cartOpen}
        lines={cart.lines}
        totals={cart.totals}
        onClose={() => setCartOpen(false)}
        onSetQuantity={cart.setQuantity}
        onRemove={cart.remove}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      <CheckoutSummary
        open={checkoutOpen}
        lines={cart.lines}
        totals={cart.totals}
        onClose={() => setCheckoutOpen(false)}
        onConfirm={() => {
          setCheckoutOpen(false);
          const count = cart.totals.itemCount;
          cart.clear();
          pushEntry("assistant", `รับคำสั่งซื้อเรียบร้อย ${count} ชิ้น ขอบคุณที่ใช้บริการครับ 🎉`);
          setSuggestions(SAMPLE_COMMANDS.slice(0, 3));
        }}
      />

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-800 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-brand-500/50"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
