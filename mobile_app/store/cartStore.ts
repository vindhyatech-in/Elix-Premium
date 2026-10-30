import { create } from 'zustand';
import { Platform } from 'react-native';
import type { CartEntry } from '../types/api';

const URGENT_FEE = 99;

// ---- Cookie & Web / Native Storage Helpers ----

function getCookie(name: string): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 30): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export const cartStorage = {
  read(key: string): CartEntry[] {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem(key);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        }
        const cookie = getCookie(key);
        if (cookie) {
          const parsed = JSON.parse(cookie);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read cart from storage:', e);
    }
    return [];
  },

  write(key: string, items: CartEntry[]): void {
    try {
      const json = JSON.stringify(items);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, json);
        setCookie(key, json);
      }
    } catch (e) {
      console.warn('Failed to write cart to storage:', e);
    }
  },

  remove(key: string): void {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        deleteCookie(key);
      }
    } catch (e) {}
  },
};

export function itemKey(entry: Pick<CartEntry, 'isPackage' | 'variantId' | 'packageId'>): string {
  return entry.isPackage ? `pkg-${entry.packageId}` : `svc-${entry.variantId}`;
}

export function mergeCarts(savedCart: CartEntry[], incomingCart: CartEntry[]): CartEntry[] {
  const map = new Map<string, CartEntry>();

  for (const item of savedCart) {
    const key = itemKey(item);
    map.set(key, { ...item });
  }

  for (const item of incomingCart) {
    const key = itemKey(item);
    if (map.has(key)) {
      const existing = map.get(key)!;
      // Add quantities together
      map.set(key, { ...existing, quantity: existing.quantity + item.quantity });
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
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

interface CartState {
  items: CartEntry[];
  isUrgent: boolean;
  userId: number | null;
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
  // User Session & Persistence
  hydrate: (userId?: number | null) => void;
  onUserLogin: (userId: number) => void;
  onUserLogout: () => void;
}

function getStorageKey(userId: number | null): string {
  return userId ? `elix_cart_user_${userId}` : 'elix_cart_guest';
}

export const useCartStore = create<CartState>((set, get) => {
  // Initial synchronous hydration if on web
  const initialItems = cartStorage.read('elix_cart_guest');
  const initialTotals = computeTotals(initialItems, false);

  return {
    items: initialItems,
    isUrgent: false,
    userId: null,
    totalItems: initialTotals.totalItems,
    subtotal: initialTotals.subtotal,
    urgentFee: initialTotals.urgentFee,
    totalAmount: initialTotals.totalAmount,

    getKey: itemKey,

    hydrate: (userId = null) => {
      const uid = userId ?? get().userId;
      const key = getStorageKey(uid);
      const items = cartStorage.read(key);
      set({
        userId: uid,
        items,
        ...computeTotals(items, get().isUrgent),
      });
    },

    onUserLogin: (userId: number) => {
      // 1. Current cart in state or in guest storage
      const currentGuestItems = get().items.length > 0 ? get().items : cartStorage.read('elix_cart_guest');

      // 2. Previously saved cart for this user account
      const userSavedItems = cartStorage.read(`elix_cart_user_${userId}`);

      // 3. Merge current guest cart with previously saved user cart
      const merged = mergeCarts(userSavedItems, currentGuestItems);

      // 4. Save merged cart for this user
      cartStorage.write(`elix_cart_user_${userId}`, merged);

      // 5. Clear guest cart so it doesn't leak
      cartStorage.remove('elix_cart_guest');

      // 6. Update state
      set({
        userId,
        items: merged,
        ...computeTotals(merged, get().isUrgent),
      });
    },

    onUserLogout: () => {
      const prevUserId = get().userId;
      if (prevUserId) {
        // Persist current state for that user before clearing
        cartStorage.write(`elix_cart_user_${prevUserId}`, get().items);
      }
      // Reset to fresh guest cart
      set({
        userId: null,
        items: [],
        isUrgent: false,
        totalItems: 0,
        subtotal: 0,
        urgentFee: 0,
        totalAmount: 0,
      });
      cartStorage.remove('elix_cart_guest');
    },

    addItem: (entry) =>
      set((state) => {
        const key = itemKey(entry);
        const existing = state.items.find((i) => itemKey(i) === key);
        const items = existing
          ? state.items.map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i))
          : [...state.items, { ...entry, quantity: 1 }];

        cartStorage.write(getStorageKey(state.userId), items);
        return { items, ...computeTotals(items, state.isUrgent) };
      }),

    removeItem: (key) =>
      set((state) => {
        const items = state.items.filter((i) => itemKey(i) !== key);
        cartStorage.write(getStorageKey(state.userId), items);
        return { items, ...computeTotals(items, state.isUrgent) };
      }),

    increment: (key) =>
      set((state) => {
        const items = state.items.map((i) =>
          itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
        );
        cartStorage.write(getStorageKey(state.userId), items);
        return { items, ...computeTotals(items, state.isUrgent) };
      }),

    decrement: (key) =>
      set((state) => {
        const items = state.items
          .map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0);
        cartStorage.write(getStorageKey(state.userId), items);
        return { items, ...computeTotals(items, state.isUrgent) };
      }),

    setUrgent: (urgent) =>
      set((state) => ({
        isUrgent: urgent,
        ...computeTotals(state.items, urgent),
      })),

    clear: () =>
      set((state) => {
        cartStorage.write(getStorageKey(state.userId), []);
        return {
          items: [],
          isUrgent: false,
          totalItems: 0,
          subtotal: 0,
          urgentFee: 0,
          totalAmount: 0,
        };
      }),
  };
});
