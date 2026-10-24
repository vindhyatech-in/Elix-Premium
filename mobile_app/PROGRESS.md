# Elix Mobile App — Build Progress Tracker

> **Stack:** React Native 0.86 + Expo SDK 57 + TypeScript + Expo Router v4
> **Backend:** Django REST API at `/api/v1/` (auth via `Authorization: Token <key>`)
> **Last Updated:** 2026-10-07

---

## ✅ Phase 1: Foundation & UI Shell — COMPLETE

### Design System & Primitives
- [x] `constants/theme.ts` — Full Elix token set (colors, typography, radii, shadows) — 1:1 parity with `static/css/variables.css`
- [x] `constants/Colors.ts` — Updated to use ElixColors tokens (removed default Expo blue)
- [x] `components/ui/Button.tsx` — 5 variants (primary, secondary, ghost, outline, urgent), 3 sizes, loading state
- [x] `components/ui/Badge.tsx` — 5 variants (urgent, discount, rating, category, neutral)
- [x] `components/ui/Card.tsx` — elevated, outlined, urgent variants
- [x] `components/ui/Header.tsx` — Indore location chip + search icon + live cart badge

### Tab Navigation
- [x] `app/(tabs)/_layout.tsx` — 5 Tabs: Home, Services, Express 50m, Bookings, Profile
  - ⚡ Urgent tab has its own `urgentRed` active tint color
  - Native iOS 88px / Android 64px tab bar heights

### Tab Screens (Static UI — Mock Data)
- [x] `app/(tabs)/index.tsx` — Home Screen
  - Hero dark banner with badge + CTA
  - Express Urgent callout card (red accent)
  - 6-category 3-column grid with circular icons
  - 2 package cards with checkmark feature lists + pricing
  - Trust Pillars section (sealed kits + certified artists)
- [x] `app/(tabs)/services.tsx` — Services Catalog Screen (Urban Company Style)
  - 5 horizontal category filter tabs
  - Service cards: name, star rating badge, duration, price, feature list
  - `+` / quantity counter (add / increment / decrement)
  - **Sticky floating bottom cart bar** (shows when `cart.totalItems > 0`)
- [x] `app/(tabs)/urgent.tsx` — Express 50-Min Screen
  - High-energy red urgency banner
  - Live slot time calculator (current time + 50 min, in 15-min slots)
  - 3 express slot selector radio cards
  - 4 quick-add urgent service cards (1-tap, urgent red CTA)
  - Rs.99 / Rs.50 pricing transparency notice
- [x] `app/(tabs)/bookings.tsx` — My Bookings Screen
  - Status filter tabs: All, Upcoming, Completed, Cancelled
  - Booking cards: order ID, date, status badge, URGENT badge
  - Assigned beautician row with call button
  - Item breakdown with urgent fee line
  - Footer with Invoice / Track / Rebook actions
- [x] `app/(tabs)/profile.tsx` — Profile Screen
  - User card with avatar + phone number
  - Saved addresses (Indore) with Home label + map context
  - Menu items: WhatsApp Support, Notifications, Terms
  - Logout button
  - App version footer

### Package Dependencies Installed
- [x] `@expo/vector-icons` (Ionicons — cross-platform icons)
- [x] `expo-router` (Expo SDK 57 bundled)
- [x] `react-native-safe-area-context` (Expo SDK 57 bundled)
- [x] TypeScript compilation: `npx tsc --noEmit` passes with 0 errors

---

## 🔄 Phase 2: Auth, State & API Integration — MOSTLY COMPLETE

### Auth Layer
- [x] `store/authStore.ts` — Zustand store (token, user, isLoggedIn, login, logout)
- [x] `lib/apiClient.ts` — Axios instance with auto `Authorization: Token` header injection
- [x] `app/auth/login.tsx` — Login screen: phone/email + password form
  - Calls `POST /api/v1/auth/login/` — returns `token` + `user`
  - Stores token in `expo-secure-store`
- [x] `app/auth/_layout.tsx` — Auth route group layout (no tab bar)
- [x] `app/_layout.tsx` — Root layout: check stored token → redirect to `(tabs)` or `auth/login`

### State Management
- [x] `store/cartStore.ts` — Zustand cart (items, addItem, removeItem, increment, decrement, clear, subtotal, totalAmount with urgent fee)
- [ ] `store/bookingFlowStore.ts` — Booking flow state (step, address, date, slot, bookingType, paymentMethod)
- [x] Install: `zustand`, `expo-secure-store`, `axios`

### API Client & Data Hooks
- [x] `lib/apiClient.ts` — Base Axios instance pointing at Django backend
- [x] `hooks/useHome.ts` — Fetches `GET /api/v1/home/`
- [x] `hooks/useCatalog.ts` — Fetches `GET /api/v1/catalog/`
- [x] `hooks/useBookings.ts` — Fetches `GET /api/v1/bookings/`
- [x] `hooks/useProfile.ts` — Fetches `GET /api/v1/profile/` and `/api/v1/addresses/`
- [x] Install: `@tanstack/react-query`

### Wire Screens to Live Data
- [ ] `app/(tabs)/index.tsx` — Replace mock data with `/api/v1/home/` response
- [x] `app/(tabs)/services.tsx` — Replace mock with `/api/v1/catalog/` + connect cart to `cartStore`
- [x] `app/(tabs)/bookings.tsx` — Replace mock with `/api/v1/bookings/`
- [x] `app/(tabs)/profile.tsx` — Replace mock with `/api/v1/profile/` + `/api/v1/addresses/`

---

## Phase 3: 5-Step Booking Bottom Drawer — TODO

- [ ] Install: `@gorhom/bottom-sheet`
- [ ] `components/booking/BookingDrawer.tsx` — 5-step sheet matching web `booking_drawer.html`
  - Step 1: Address selector (saved addresses list + Add New form)
  - Step 2: Calendar date picker (today + 14 days)
  - Step 3: Booking type toggle (Regular vs Urgent) + slot picker
    - Regular: Morning / Afternoon / Evening tiles
    - Urgent: Live slots from `GET /api/v1/bookings/urgent-slots/`
  - Step 4: Payment method (Pay Now via Razorpay OR Pay at Home)
  - Step 5: Order summary review with price breakdown
- [ ] `components/booking/StepAddress.tsx`
- [ ] `components/booking/StepDate.tsx` — Calendar grid
- [ ] `components/booking/StepSlot.tsx` — Slot picker
- [ ] `components/booking/StepPayment.tsx`
- [ ] `components/booking/StepSummary.tsx`
- [ ] Wire "Proceed to Booking" sticky bar in `services.tsx` to open BookingDrawer
- [ ] Backend: Add `GET /api/v1/bookings/urgent-slots/` endpoint

---

## Phase 4: Payments & Order Confirmation — COMPLETE

- [x] Install: `react-native-razorpay` (for bare builds) + razorpay Python SDK
- [x] Razorpay flow built into `StepSummary.tsx` with native + web + Expo Go fallbacks — Native Razorpay modal
- [x] Wire Pay Now path: `POST /api/v1/payments/razorpay/create-order/`
- [x] Pay at Home path: direct `POST /api/v1/bookings/checkout/` (already built)
- [x] `app/booking-confirmed.tsx` — Confirmation screen (Lottie animation + booking number)

---

## Phase 5: Push Notifications & Live Tracking — TODO

- [ ] Install: `expo-notifications`, configure FCM + APNs
- [ ] Firebase project setup + `google-services.json` / `GoogleService-Info.plist`
- [ ] Push notification handlers: Artist Assigned, Artist En Route, Urgent Overlap Alert
- [ ] `app/tracking/[bookingNumber].tsx` — Live tracking screen with beautician card + status timeline

---

## Phase 6: App Store / Google Play Release — TODO

- [ ] `app.json` — Set `bundleIdentifier: "in.elix.app"`, `package: "in.elix.app"`, `name: "Elix"`, `icon`
- [ ] Generate Elix app icon (1024x1024 PNG) + splash screen
- [ ] EAS Build: `eas build --platform all`
- [ ] Google Play Console — internal track, upload `.aab`
- [ ] Apple App Store Connect — TestFlight then App Store
- [ ] Google Play Data Safety form + Apple NSLocationWhenInUseUsageDescription

---

## Dependency Install Commands (All Phases)

```bash
# Phase 2
npx expo install zustand expo-secure-store axios @tanstack/react-query

# Phase 3
npx expo install @gorhom/bottom-sheet expo-location react-native-maps

# Phase 4
npm install react-native-razorpay

# Phase 5
npx expo install expo-notifications
```

---

## Backend API Endpoints Reference

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `GET /api/v1/home/` | GET | Public | Ready |
| `GET /api/v1/catalog/` | GET | Public | Ready |
| `GET /api/v1/categories/` | GET | Public | Ready |
| `GET /api/v1/offers/` | GET | Public | Ready |
| `POST /api/v1/validate-coupon/` | POST | Public | Ready |
| `GET /api/v1/serviceability/` | GET | Public | Ready |
| `POST /api/v1/auth/login/` | POST | Public | Ready |
| `POST /api/v1/auth/logout/` | POST | Token | Ready |
| `GET/POST /api/v1/profile/` | GET/POST | Token | Ready |
| `GET/POST /api/v1/addresses/` | GET/POST | Token | Ready |
| `DELETE /api/v1/addresses/<id>/` | DELETE | Token | Ready |
| `GET /api/v1/bookings/` | GET | Token | Ready |
| `POST /api/v1/bookings/checkout/` | POST | Token | Ready (Pay at Home only) |
| `POST /api/v1/bookings/<num>/cancel/` | POST | Token | Ready |
| `GET /api/v1/bookings/urgent-slots/` | GET | Public | TODO (Phase 3) |
| `POST /api/v1/payments/razorpay/create-order/` | POST | Token | Ready |
