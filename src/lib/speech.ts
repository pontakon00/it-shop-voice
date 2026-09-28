export type AlternativeLike = { transcript: string; confidence: number };
export type ResultLike = { isFinal: boolean; length: number; [index: number]: AlternativeLike };
export type ResultListLike = { length: number; [index: number]: ResultLike };
export type ResultEventLike = { resultIndex: number; results: ResultListLike };
export type ErrorEventLike = { error: string; message?: string };

export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: ErrorEventLike) => void) | null;
  onresult: ((event: ResultEventLike) => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

export const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์ก่อน",
  "service-not-allowed": "การตั้งค่าการจดจำเสียงถูกปิดอยู่",
  "no-speech": "ไม่ได้ยินเสียง ลองพูดอีกครั้ง",
  "audio-capture": "ไม่พบไมโครโฟนหรือไม่สามารถเข้าถึงได้",
  network: "การเชื่อมต่อเครือข่ายมีปัญหา",
  aborted: "การฟังถูกยกเลิก",
};

export function getSpeechRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * ฝั่ง server ตอบ true ไว้ก่อน แล้วค่อยตรวจจริงบน client
 * เพื่อให้ useSyncExternalStore จัดการ hydration ได้ถูกต้อง
 */
export function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return true;
  return Boolean(getSpeechRecognitionCtor());
}

export const NOOP_SUBSCRIBE = () => () => {};
