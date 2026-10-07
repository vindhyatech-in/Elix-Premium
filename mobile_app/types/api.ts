// API response types that mirror Django backend shapes

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthLoginResponse {
  ok: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface Profile {
  ok: boolean;
  user: {
    email: string;
    first_name: string;
    last_name: string;
  };
  phone: string;
}

export interface Address {
  id: number;
  label: string;
  text: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

// ---- Catalog ----

export interface CatalogItem {
  kind: 'service' | 'package';
  id: number;
  name: string;
  category: string;
  price: number;
  original_price: number | null;
  duration: number;
  description: string;
  features: string[];
  image?: string;
  // service-specific
  variant_id?: number;
  label?: string;
  // package-specific
  package_id?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
}

// ---- Home ----

export interface HomeHero {
  eyebrow: string;
  headline_lines: string[];
  subhead: string;
  primary_cta_label: string;
  primary_cta_href: string;
  photo: string | null;
}

export interface PromoBanner {
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  photo: string | null;
}

export interface Beautician {
  slug: string;
  name: string;
  specialties: string;
  rating: number;
  reviews: number;
  skills: string[];
  experience_years: number;
  photo: string | null;
}

export interface HomeData {
  status: string;
  hero: HomeHero | null;
  promo_banners: PromoBanner[];
  categories: Category[];
  how_it_works: Array<{ step: number; title: string; body: string; icon: string }>;
  before_after: Array<{ label: string; tone: string; before_photo: string | null; after_photo: string | null }>;
  testimonials: Array<{ name: string; location: string; rating: number; quote: string; service: string }>;
  beauticians: Beautician[];
  trust_points: Array<{ value: string; suffix: string; label: string; icon: string }>;
  trust_badges: Array<{ title: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

// ---- Bookings ----

export interface BookingItem {
  name: string;
  price: number;
  quantity: number;
  included: string[];
}

export interface Booking {
  booking_number: string;
  status: string;
  status_display: string;
  scheduled_date: string;
  booking_type: 'regular' | 'urgent';
  time_slot: string | null;
  time_slot_display: string | null;
  exact_time: string | null;
  address_label: string;
  address_text: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  can_cancel: boolean;
  start_otp: string | null;
  items: BookingItem[];
}

// ---- Cart ----

export interface CartEntry {
  variantId?: number;
  packageId?: number;
  isPackage: boolean;
  name: string;
  price: number;
  duration: number;
  quantity: number;
}
