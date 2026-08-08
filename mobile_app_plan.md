# Mobile App Plan: Elix (Premium Salon at Home)

> **App Name:** Elix  
> **Tagline:** Premium Salon at Home  
> **Service Location:** Indore, MP  
> **Key Differentiator:** 50-Minute Express Urgent Salon Service  
> **Target Platforms:** Android & iOS (Built using Flutter)  
> **Architecture Principle:** Dedicated Flutter code under `mobile_app/` with isolated Django backend API endpoints under `api/`. Web app functionality remains 100% untouched.

---

## 🎨 Design System & Theme Guidelines (Synced with Existing Web UI)

The Elix Mobile App directly inherits design tokens from the existing web codebase (`static/css/variables.css`):

- **Primary Brand / Accent (Royal Indigo):** `#4F46E5` (Light mode) / `#818CF8` (Dark mode)
- **Secondary Accent (Emerald Green):** `#059669` (Highlights, offers, urgent badges)
- **Background Surface (Slate/Light):** `#F8FAFC` (Page surface), `#FFFFFF` (Card surface)
- **Dark Theme Surface (Deep Slate):** `#0F172A` (Background), `#1E293B` (Cards & Sheets)
- **Text Colors:** `#0F172A` (Primary text), `#64748B` (Muted/Subtext)
- **Typography:** `Inter` / Clean Modern Sans-Serif
- **UI Style:** Modern luxury, glassmorphism card surfaces, rounded corners (`16px`/`24px`), dynamic micro-animations.

---

## 📁 Directory Structure & File Organization

```text
GlamourAtHome/
├── mobile_app/                           <-- [NEW] Flutter Project Directory
│   ├── android/                          <-- Android Native Config & Launcher Icons
│   ├── ios/                              <-- iOS Native Config & Assets
│   ├── assets/                           <-- App Logos, Icons & Service Vectors
│   ├── lib/
│   │   ├── main.dart                     <-- App Entry Point & Theme Provider
│   │   ├── core/
│   │   │   ├── constants/
│   │   │   │   ├── app_colors.dart       <-- Indigo, Emerald, Slate palette
│   │   │   │   ├── app_strings.dart      <-- Tagline, Indore city scope, 50-min urgency text
│   │   │   │   └── api_endpoints.dart    <-- Connections to Django API
│   │   │   ├── network/
│   │   │   │   └── api_client.dart       <-- Http/Dio Client with Token Auth
│   │   │   ├── theme/
│   │   │   │   └── app_theme.dart        <-- Dark/Light ThemeData definitions
│   │   │   └── utils/
│   │   │       └── location_helper.dart  <-- Geofencing / Indore serviceability validation
│   │   ├── features/
│   │   │   ├── auth/                     <-- Login, Signup, OTP Verification
│   │   │   ├── home/                     <-- Home Banner, Category List, Quick 50-min Express CTA
│   │   │   ├── catalog/                  <-- Salon Services, Packages, Category Filtering
│   │   │   ├── urgent_service/           <-- 50-Min Express Booking Flow & Live Timer
│   │   │   ├── booking/                  <-- Cart, Date/Slot Selection, Address in Indore, Checkout
│   │   │   ├── tracking/                 <-- Live Beautician Tracking & Status Updates
│   │   │   └── profile/                  <-- My Bookings, Saved Addresses, Support
│   │   └── widgets/                      <-- Reusable Buttons, Cards, Bottom Sheets, Badges
│   └── pubspec.yaml
│
├── api/                                  <-- [NEW] Isolated Django App for Mobile REST APIs
│   ├── __init__.py
│   ├── apps.py
│   ├── urls.py                           <-- /api/v1/ endpoints
│   ├── views/
│   │   ├── auth_views.py                 <-- Mobile authentication (Token/JWT)
│   │   ├── catalog_views.py              <-- Services, Categories, Packages
│   │   ├── booking_views.py              <-- Order creation & 50-min urgent dispatch
│   │   └── location_views.py             <-- Pincode & Indore boundary check
│   └── serializers.py                    <-- REST Serializers for models
```

---

## 🚀 Implementation Roadmap & Status

### Phase 1: Planning & Setup 
- [x] Create project blueprint document (`mobile_app_plan.md`)
- [x] Initialize Flutter app structure in `mobile_app/`
- [x] Setup `api/` Django app for safe, non-breaking mobile APIs

### Phase 2: Theme & Core Foundation 
- [x] Configure `AppColors`, `AppTheme` (matching Web UI indigo/emerald luxury theme)
- [x] Setup location serviceability validator for Indore, MP
- [ ] Implement API client with authorization header handling

### Phase 3: Features & Screens 
- [ ] **Auth Flow:** Phone/OTP login & guest view
- [x] **Home Dashboard:** Hero banner, 50-Min Urgent Service CTA button, category grid
- [ ] **Services Catalog:** Category view, service detail modal, cart management
- [x] **50-Min Express Booking:** Priority dispatch flow with 50-minute countdown indicator
- [ ] **Standard Booking:** Address selection (Indore areas), date/time slot chooser
- [ ] **Live Booking Tracker:** Status updates (Confirmed -> Professional Assigned -> On the Way -> In Progress -> Completed)

### Phase 4: API Integration & Verification 
- [ ] Test Django API endpoints against Flutter app
- [ ] Verify web app remaining completely unaffected
- [ ] Android & iOS build check

---

## 📝 Implementation Progress Log

* **2026-08-07:** Initialized `mobile_app_plan.md` with theme parameters, directory layout, and roadmap.
* **2026-08-07:** Initialized Flutter project under `mobile_app/` (Android & iOS targets).
* **2026-08-07:** Mounted non-breaking mobile Django REST API (`/api/v1/`) with Indore serviceability check.
* **2026-08-07:** Created initial Flutter home screen featuring **50-Min Express Booking** banner and Indore pincode checker.

