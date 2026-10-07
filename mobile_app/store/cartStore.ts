import { create } from 'zustand';
import type { CartEntry } from '../types/api';

const URGENT_FEE = 99;

interface CartState {
  items: CartEntry[];
  isUrgent: boolean;
  // Computed
  totalItems: number;
  subtotal: number;
  urgentFee: number;
  totalAmount: number;
  // Actions
  addItem: (entry: Omit<CartEntry, 'quantity'>) => void;
  removeItem: (key: string) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  setUrgent: (urgent: boolean) => void;
  clear: () => void;
  getKey: (entry: Pick<CartEntry, 'isPackage' | 'variantId' | 'packageId'>) => string;
}

function itemKey(entry: Pick<CartEntry, 'isPackage' | 'variantId' | 'packageId'>): string {
  return entry.isPackage ? `pkg-${entry.packageId}` : `svc-${entry.variantId}`;
}

function computeTotals(items: CartEntry[], isUrgent: boolean) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const urgentFee = isUrgent ? URGENT_FEE : 0;
  return {
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    urgentFee,
    totalAmount: subtotal + urgentFee,
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isUrgent: false,
  totalItems: 0,
  subtotal: 0,
  urgentFee: 0,
  totalAmount: 0,

  getKey: itemKey,

  addItem: (entry) =>
    set((state) => {
      const key = itemKey(entry);
      const existing = state.items.find((i) => itemKey(i) === key);
      const items = existing
        ? state.items.map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i))
        : [...state.items, { ...entry, quantity: 1 }];
      return { items, ...computeTotals(items, state.isUrgent) };
    }),

  removeItem: (key) =>
    set((state) => {
      const items = state.items.filter((i) => itemKey(i) !== key);
      return { items, ...computeTotals(items, state.isUrgent) };
    }),

  increment: (key) =>
    set((state) => {
      const items = state.items.map((i) =>
        itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
      );
      return { items, ...computeTotals(items, state.isUrgent) };
    }),

  decrement: (key) =>
    set((state) => {
      const items = state.items
        .map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
      return { items, ...computeTotals(items, state.isUrgent) };
    }),

  setUrgent: (urgent) =>
    set((state) => ({
      isUrgent: urgent,
      ...computeTotals(state.items, urgent),
    })),

  clear: () =>
    set({
      items: [],
      isUrgent: false,
      totalItems: 0,
      subtotal: 0,
      urgentFee: 0,
      totalAmount: 0,
    }),
}));
