import type { CartLine, Product } from "./types";

const STORAGE_KEY = "it-shop-voice:cart";
const MAX_QUANTITY = 99;

const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();

let snapshot: CartLine[] = EMPTY;
let loaded = false;

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value)));
}

function isCartLine(value: unknown): value is CartLine {
  const candidate = value as CartLine | null;
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    typeof candidate.product?.id === "string" &&
    typeof candidate.quantity === "number"
  );
}

function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    return parsed.filter(isCartLine).map((line) => ({
      product: line.product,
      quantity: clampQuantity(line.quantity),
    }));
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  snapshot = readStoredCart();
}

function write(lines: CartLine[]) {
  snapshot = lines;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // โหมดส่วนตัวหรือพื้นที่จัดเก็บเต็ม — ใช้งานต่อได้โดยไม่บันทึก
  }
  listeners.forEach((listener) => listener());
}

/** ตะกร้าถูกเก็บใน localStorage จึงต้องอ่านฝั่ง client เท่านั้น (useSyncExternalStore จัดการส่วนนี้ให้) */
export function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CartLine[] {
  ensureLoaded();
  return snapshot;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

export function addProduct(product: Product, quantity = 1) {
  const current = getSnapshot();
  const existing = current.find((line) => line.product.id === product.id);

  const next = existing
    ? current.map((line) =>
        line.product.id === product.id
          ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
          : line,
      )
    : [...current, { product, quantity: clampQuantity(quantity) }];

  write(next);
}

export function removeProduct(productId: string) {
  write(getSnapshot().filter((line) => line.product.id !== productId));
}

export function setProductQuantity(productId: string, quantity: number) {
  const current = getSnapshot();

  write(
    quantity <= 0
      ? current.filter((line) => line.product.id !== productId)
      : current.map((line) =>
          line.product.id === productId
            ? { ...line, quantity: clampQuantity(quantity) }
            : line,
        ),
  );
}

export function clearCart() {
  write(EMPTY);
}

export { MAX_QUANTITY };
