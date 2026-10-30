# Elix — Web to Mobile App Development & Parity Progress

> **Project:** Elix (GlamourAtHome)  
> **Web Stack:** Django 5.x + PostgreSQL/SQLite + Vanilla CSS/JS + Razorpay Standard Web Checkout  
> **Mobile Stack:** React Native 0.86 + Expo SDK 57 + TypeScript + Expo Router v4 + Zustand + TanStack React Query  
> **Backend API:** Django REST framework at `/api/v1/` & `/api/` (Token authentication: `Authorization: Token <key>`)  
> **Last Updated:** 2026-10-26  

---

## 📊 1. High-Level Project Phase Tracker

| Phase | Description | Status | Key Highlights |
|---|---|---|---|
| **Phase 1: Foundation & UI Shell** | Theme tokens, atomic components, navigation tabs | ✅ **COMPLETE** | Elix gold/dark theme tokens, 5 main tabs (`(tabs)/_layout.tsx`), responsive UI cards & badges |
| **Phase 2: Auth, Stores & Base API** | Zustand global stores, Axios client, Credential login | ✅ **COMPLETE** | `authStore`, `cartStore`, `apiClient`, `app/auth/login.tsx` with show/hide password toggle |
| **Phase 3: 5-Step Booking Drawer** | Slide-up bottom sheet for end-to-end booking flow | ✅ **COMPLETE** | Address, Date (21-day calendar), Slot (Regular & Urgent 50m), Payment method, Order Summary |
| **Phase 4: Payments, Webhooks & Auto-Refund** | Razorpay Standard Checkout & Auto-Refund | ✅ **COMPLETE** | Web Checkout modal, mobile order creation + signature verification, auto-refund on booking cancellation |
| **Phase 5: Web-to-Mobile Feature Parity** | Fill all gaps between Web app and Mobile app | 🔄 **IN PROGRESS** | Home CMS data wiring, Express 50m tab wiring, Mobile Signup, Live Tracking screen, Service details |
| **Phase 6: Push Notifications & Live GPS** | Native push notifications & beautician GPS tracker | ⏳ **TODO** | `expo-notifications`, FCM / APNs background alerts, beautician live location |
| **Phase 7: Store Release & Production Build** | Production deployment on App Store & Google Play | ⏳ **TODO** | App icons (1024x1024), splash screen, adaptive icons, EAS Build pipeline (`eas build`) |

---

## 🔍 2. Web vs. Mobile Feature Parity Matrix

This table maps every capability present in the Elix Web App against the React Native Mobile App (`mobile_app/`).

| Feature / Module | Web App (`GlamourAtHome`) | Mobile App (`mobile_app/`) | Status | Parity Gap / Action Required |
|---|---|---|---|---|
| **Design System & Theme** | `variables.css` (Gold, Dark, Cream, Urgent Coral) | `constants/theme.ts` matching 1:1 | ✅ **Parity** | Fully synced tokens, typography, radii, and shadows |
| **Catalog & Services** | Category filters + Service cards + Add to Cart | Category list + Service cards | ✅ **Parity** | List-to-cart workflow implemented in `services.tsx` |
| **Cart System** | Slide-out cart drawer + Sticky bottom bar | `cartStore.ts` + Floating cart bar | ✅ **Parity** | Persistent cart, item counters, subtotal calculation |
| **5-Step Booking Drawer** | `templates/booking/components/booking_drawer.html` | `components/booking/BookingDrawer.tsx` | ✅ **Parity** | Address → Date → Slot → Payment → Summary steps complete |
| **Razorpay Payments** | Standard Web Checkout (`checkout.js`) modal | Dual flow: Pay at Home & Razorpay Pay Now | ✅ **Parity** | `useRazorpay.ts` mutation, webhook verification, secure signatures |
| **Booking Confirmation** | Booking receipt & status confirmation | `app/booking-confirmed.tsx` | ✅ **Parity** | Celebration animation, booking reference, view orders CTA |
| **Cancellation & Auto-Refund** | Web customer cancel triggers `create_refund` | Mobile cancel calls backend `create_refund` | ✅ **Parity** | Automated refund for Razorpay online-paid bookings |
| **Home Screen CMS Data** | Dynamic CMS (Hero banner, Trust badges, Stats) | Mock hardcoded constants in `index.tsx` | ⚠️ **Partial** | **Needs wiring**: hook `useHome()` into `app/(tabs)/index.tsx` |
| **Urgent 50-Min Express Tab** | Dynamic slots from `/urgent-slots/` + Rush bonus | Static UI with unhandled buttons in `urgent.tsx`| ⚠️ **Partial** | **Needs wiring**: connect `+ Add` to cart & open drawer in urgent mode |
| **Auth: Credential Login** | Email/Username + Password with Show Password toggle | `app/auth/login.tsx` with Show Password toggle | ✅ **Parity** | Token saved securely to device via `expo-secure-store` |
| **Auth: Customer Sign Up** | Full registration form (Name, Email, Phone, Age) | **Missing** in mobile app | ❌ **Missing** | **Build `app/auth/signup.tsx`** + backend `POST /api/v1/auth/signup/` |
| **Auth: WhatsApp / SMS OTP** | Passwordless 6-digit OTP login | **Missing** in mobile app | ❌ **Missing** | **Build `app/auth/otp-login.tsx`** + OTP request/verify endpoints |
| **Auth: Password Reset** | Django password reset flow | **Missing** in mobile app | ❌ **Missing** | **Build `app/auth/forgot-password.tsx`** |
| **Service Detail Page** | Urban Company style with FAQs & variant options | **Missing** in mobile app | ❌ **Missing** | **Build `app/services/[slug].tsx`** |
| **Live Order Tracking** | Beautician assigned, On the way, Start OTP | "Track" button in `bookings.tsx` has empty handler | ❌ **Missing** | **Build `app/bookings/[id]/track.tsx`** with live status & OTP card |
| **Reschedule Booking** | Reschedule upcoming booking to new date/time | **Missing** in mobile app | ❌ **Missing** | **Build Reschedule modal** + backend `reschedule/` endpoint |
| **Invoice Viewer / PDF** | Downloadable PDF tax invoice | "Invoice" button in `bookings.tsx` is static | ❌ **Missing** | **Build Invoice preview / PDF download viewer** |
| **Customer Reviews** | Post-service 1–5 star rating + text feedback | **Missing** in mobile app | ❌ **Missing** | **Build Review submission modal** + backend review endpoint |
| **Profile: Add Address** | Address modal with GPS pin drop / autocomplete | `+ Add New` button in `profile.tsx` is static | ❌ **Missing** | **Build Address Bottom Sheet modal in Profile** |
| **In-App Notifications** | Notification bell dropdown + mark-as-read API | "Notifications" item in `profile.tsx` is static | ❌ **Missing** | **Build `app/notifications.tsx`** screen |
| **Push Notifications** | Transactional emails + SMS | FCM & APNs background notifications | ⏳ **Phase 6** | Install `expo-notifications`, token registration endpoint |

---

## 🛠️ 3. Detailed Remaining Backlog by Priority

### 🔴 Priority 1: Home & Urgent Screens Live Wiring (Highest Impact)

#### 1.1 Home Screen Dynamic Wiring (`mobile_app/app/(tabs)/index.tsx`)
- **Current State:** The home screen uses static mock objects `CATEGORIES` and `PACKAGES`.
- **Tasks:**
  - [ ] Import `useHome` from `@/hooks/useHome`.
  - [ ] Replace static categories with `data.categories` mapped to category icons.
  - [ ] Replace static packages with `data.featured_packages` or `data.popular_services`.
  - [ ] Add `RefreshControl` for pull-to-refresh pulling fresh CMS data.
  - [ ] Wire banner clicks directly to the appropriate catalog category or service.

#### 1.2 Urgent 50-Min Express Screen Wiring (`mobile_app/app/(tabs)/urgent.tsx`)
- **Current State:** Layout is implemented, but the `+ Add` button and time slot chips are not connected to application state.
- **Tasks:**
  - [ ] Connect `+ Add` button to `cartStore.addItem()`.
  - [ ] Connect slot buttons to set selected slot and launch `BookingDrawer` with `bookingType: 'urgent'`.
  - [ ] Fetch live express service offerings from `/api/v1/catalog/?is_urgent=true`.

---

### 🟡 Priority 2: Authentication & Customer Onboarding

#### 2.1 Customer Registration Screen (`mobile_app/app/auth/signup.tsx`)
- **Current State:** Users can only log in using existing accounts. There is no in-app registration flow.
- **Tasks:**
  - [ ] Create `mobile_app/app/auth/signup.tsx` with inputs:
    - First Name & Last Name
    - Phone Number (`+91` pre-filled)
    - Email Address
    - Age (validation: 18+)
    - Password & Confirm Password (with Show/Hide password toggle)
  - [ ] Implement backend endpoint: `POST /api/v1/auth/signup/` in `api/views.py`.
  - [ ] Automatically log in the user and save the auth token on successful registration.

#### 2.2 WhatsApp / SMS OTP Login (`mobile_app/app/auth/otp-login.tsx`)
- **Current State:** Web supports passwordless phone OTP; mobile app currently only supports username/password login.
- **Tasks:**
  - [ ] Build 2-step OTP flow:
    - Step 1: Phone number entry with "Send OTP via WhatsApp / SMS".
    - Step 2: 6-digit OTP code input boxes with 60s countdown timer and "Resend OTP".
  - [ ] Expose backend endpoints:
    - `POST /api/v1/auth/phone/request/` (calls existing WhatsApp/SMS adapter).
    - `POST /api/v1/auth/phone/verify/` (validates OTP and issues Django Rest Framework Token).

#### 2.3 Forgot Password Screen (`mobile_app/app/auth/forgot-password.tsx`)
- **Tasks:**
  - [ ] Build reset request screen asking for registered Email or Phone.
  - [ ] Expose backend endpoint `POST /api/v1/auth/password-reset/` to trigger reset link/OTP.

---

### 🟢 Priority 3: Urban Company Style Service Detail Page

#### 3.1 Service Detail Screen (`mobile_app/app/services/[slug].tsx`)
- **Current State:** Clicking a service in the catalog adds it directly to cart, without an informative detail page.
- **Tasks:**
  - [ ] Create dynamic route `mobile_app/app/services/[slug].tsx`.
  - [ ] Implement rich Urban Company layout:
    - Image carousel / Hero banner with back button and share button.
    - Duration, rating badge, reviews count, and pricing.
    - **Variant Selector**: Radio/chip selector for service variants (e.g., Honey Wax vs RICA Wax).
    - **"What's Included" Checklist**: Itemized steps (Cleansing, Scrubbing, Mask, Massage).
    - **Elix Sealed-Kit Guarantee**: Hygiene guarantee badge & single-use disposable tools notice.
    - **Aftercare Tips**: Collapsible bullet points for customer post-treatment care.
    - **FAQ Accordion**: Expandable frequently asked questions.
    - **Sticky Bottom Cart Bar**: Price, quantity counter, and "Add to Cart" button.

---

### 🔵 Priority 4: Booking Lifecycle & Live Tracking

#### 4.1 Live Order Tracking Screen (`mobile_app/app/bookings/[id]/track.tsx`)
- **Current State:** The "Track" button on `bookings.tsx` does nothing.
- **Tasks:**
  - [ ] Create `mobile_app/app/bookings/[id]/track.tsx`.
  - [ ] Implement 4-stage visual timeline:
    1. `Booking Confirmed` (Date & time locked)
    2. `Beautician Assigned` (Show beautician profile, name, photo, and 1-tap call button)
    3. `Beautician on the Way` (Live arrival status + **Prominent 4-Digit Start OTP Card**)
    4. `Service in Progress` → `Completed`
  - [ ] Prominently display the **Start OTP**: The beautician cannot start service without this OTP from the customer.

#### 4.2 Reschedule Booking Modal
- **Current State:** Customers can cancel bookings, but cannot reschedule them from mobile.
- **Tasks:**
  - [ ] Build Reschedule modal with Date & Time slot picker.
  - [ ] Backend API: `POST /api/v1/bookings/<booking_number>/reschedule/`.

#### 4.3 Invoice Preview & Download
- **Current State:** "Invoice" button on booking cards has no handler.
- **Tasks:**
  - [ ] Wire "Invoice" button to open an in-app styled invoice modal or download PDF receipt via `expo-file-system` & `expo-sharing`.

#### 4.4 Ratings & Reviews Modal
- **Current State:** Completed bookings cannot be reviewed in mobile.
- **Tasks:**
  - [ ] Build Star Rating (1 to 5 stars) + Feedback text area bottom sheet.
  - [ ] Backend API: `POST /api/v1/bookings/<id>/review/`.

---

### 🟣 Priority 5: Profile & In-App Notifications

#### 5.1 Add Address Modal in Profile (`mobile_app/app/(tabs)/profile.tsx`)
- **Current State:** Address management is only possible inside Step 1 of `BookingDrawer`.
- **Tasks:**
  - [ ] Wire `+ Add New` button in `profile.tsx` to open the address form bottom sheet.
  - [ ] Support setting default address and deleting addresses.

#### 5.2 In-App Notifications Screen (`mobile_app/app/notifications.tsx`)
- **Current State:** "Notifications" row in Profile does not navigate.
- **Tasks:**
  - [ ] Build `app/notifications.tsx` list showing booking updates, offers, and reminders.
  - [ ] Backend API: `GET /api/v1/notifications/` and `POST /api/v1/notifications/<id>/read/`.

---

### ⚪ Priority 6: Push Notifications & Release Preparation

#### 6.1 Native Push Notifications
- **Tasks:**
  - [ ] Install `expo-notifications` and configure Android Notification Channels + iOS APNs certificates.
  - [ ] Expose backend endpoint `POST /api/v1/fcm-token/` to register device tokens.
  - [ ] Send push alerts on: Beautician assigned, Beautician on the way, Service completed.

#### 6.2 App Store & Google Play Release Checklist
- [ ] Configure `app.json`:
  - `bundleIdentifier`: `in.elix.app`
  - `package`: `in.elix.app`
  - `version`: `1.0.0`
  - `permissions`: Location, Notifications, Camera/Photos (optional for review upload)
- [ ] Generate production app icon (`1024x1024 png`), adaptive foreground/background icon, and splash screen.
- [ ] Set up EAS Build configuration (`eas.json`) for Android AAB and iOS IPA.

---

## 🔌 4. Backend API Contract Matrix

| Endpoint | Method | Auth Required | Status | Mobile Screen / Feature |
|---|---|---|---|---|
| `/api/v1/home/` | GET | None (Public) | ✅ Ready | `app/(tabs)/index.tsx` (Hero, Banners, Showcase) |
| `/api/v1/catalog/` | GET | None (Public) | ✅ Ready | `app/(tabs)/services.tsx` (Categories & Services) |
| `/api/v1/categories/` | GET | None (Public) | ✅ Ready | Category horizontal filter chips |
| `/api/v1/offers/` | GET | None (Public) | ✅ Ready | Promo banners & discounts |
| `/api/v1/validate-coupon/` | POST | None (Public) | ✅ Ready | `StepPayment.tsx` (Promo code validation) |
| `/api/v1/serviceability/` | GET | None (Public) | ✅ Ready | Indore pincode coverage check |
| `/api/v1/auth/login/` | POST | None (Public) | ✅ Ready | `app/auth/login.tsx` (Username/password login) |
| `/api/v1/auth/signup/` | POST | None (Public) | ❌ **To Build** | `app/auth/signup.tsx` (New user registration) |
| `/api/v1/auth/phone/request/` | POST | None (Public) | ❌ **To Build** | `app/auth/otp-login.tsx` (Send WhatsApp/SMS OTP) |
| `/api/v1/auth/phone/verify/` | POST | None (Public) | ❌ **To Build** | `app/auth/otp-login.tsx` (Verify OTP & return token) |
| `/api/v1/auth/logout/` | POST | `Token <key>` | ✅ Ready | Profile sign-out action |
| `/api/v1/profile/` | GET/POST | `Token <key>` | ✅ Ready | `app/(tabs)/profile.tsx` (User info) |
| `/api/v1/addresses/` | GET/POST | `Token <key>` | ✅ Ready | Saved address list & creation |
| `/api/v1/addresses/<id>/` | DELETE | `Token <key>` | ✅ Ready | Remove saved address |
| `/api/v1/bookings/` | GET | `Token <key>` | ✅ Ready | `app/(tabs)/bookings.tsx` (Booking history) |
| `/api/v1/bookings/checkout/` | POST | `Token <key>` | ✅ Ready | Create Pay at Home booking |
| `/api/v1/bookings/<num>/cancel/` | POST | `Token <key>` | ✅ Ready | Cancel booking + triggers auto-refund |
| `/api/v1/bookings/<num>/reschedule/`| POST | `Token <key>` | ❌ **To Build** | Reschedule booking date/time |
| `/api/v1/bookings/<id>/review/` | POST | `Token <key>` | ❌ **To Build** | Submit 1–5 star rating & review |
| `/api/v1/payments/razorpay/create-order/` | POST | `Token <key>` | ✅ Ready | Create Razorpay order ID |
| `/api/v1/payments/razorpay/verify/` | POST | `Token <key>` | ✅ Ready | Verify signature & confirm booking |
| `/api/v1/notifications/` | GET/POST | `Token <key>` | ❌ **To Build** | In-app notification feed & mark read |
| `/api/v1/fcm-token/` | POST | `Token <key>` | ❌ **To Build** | Register push notification device token |

---

## 🔒 5. Exclusion Rules & Git Conventions

- **Protected Untracked Files:** Do NOT commit, stage, or track:
  - `ELIX_FULL_AUDIT.md`
  - `app.md`
  - `elix_agreement.pdf`
  - `elix_requiremnets.pdf`
- **Environment Files:** `.env` and `mobile_app/.env` are strictly git-ignored.
- **Git State Hygiene:** Web Auth UI changes (`static/css/auth.css`, `templates/account/login.html`, `templates/account/signup.html`) remain staged as requested by the user until an explicit commit command is given.
