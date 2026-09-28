"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getSpeechRecognitionCtor,
  hasSpeechRecognition,
  NOOP_SUBSCRIBE,
  SPEECH_ERROR_MESSAGES,
  type RecognitionLike,
  type ResultEventLike,
} from "@/src/lib/speech";

export type SpeechStatus = "idle" | "listening" | "processing" | "error";

type Options = {
  lang?: string;
  onFinal: (transcript: string) => void | Promise<void>;
};

export function useSpeechRecognition({ lang = "th-TH", onFinal }: Options) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supported = useSyncExternalStore(NOOP_SUBSCRIBE, hasSpeechRecognition, () => true);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError(null);
      setInterim("");
      setStatus("listening");
    };

    recognition.onend = () => {
      setInterim("");
      setStatus((current) => (current === "listening" ? "idle" : current));
    };

    recognition.onerror = (event) => {
      setInterim("");
      setError(SPEECH_ERROR_MESSAGES[event.error] ?? `เกิดข้อผิดพลาด: ${event.error}`);
      setStatus("error");
    };

    recognition.onresult = (event: ResultEventLike) => {
      let partial = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) final += chunk;
        else partial += chunk;
      }

      if (partial) setInterim(partial);
      if (!final.trim()) return;

      setInterim("");
      setStatus("processing");
      void Promise.resolve(onFinalRef.current(final.trim())).finally(() => {
        setStatus("idle");
      });
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      // เรียก start() ซ้ำจะ throw — กำลังฟังอยู่แล้วจึงปล่อยผ่าน
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    setStatus("idle");
    setInterim("");
    setError(null);
  }, []);

  return { status, interim, error, supported, start, stop, reset };
}
