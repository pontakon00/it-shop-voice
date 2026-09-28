"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addProduct,
  clearCart,
  getServerSnapshot,
  getSnapshot,
  MAX_QUANTITY,
  removeProduct,
  setProductQuantity,
  subscribe,
} from "@/src/lib/cartStore";

const FREE_SHIPPING_THRESHOLD = 3000;
const SHIPPING_FEE = 50;

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((product: Parameters<typeof addProduct>[0], quantity = 1) => {
    addProduct(product, quantity);
  }, []);

  const remove = useCallback((productId: string) => {
    removeProduct(productId);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setProductQuantity(productId, quantity);
  }, []);

  const clear = useCallback(() => {
    clearCart();
  }, []);

  const totals = useMemo(() => {
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    return { itemCount, subtotal, shipping, total: subtotal + shipping };
  }, [lines]);

  return { lines, totals, add, remove, setQuantity, clear };
}

export { FREE_SHIPPING_THRESHOLD, MAX_QUANTITY, SHIPPING_FEE };
