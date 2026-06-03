export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'gathering'
  | 'serving'
  | 'delivered';

export interface OrderItem {
  id:    string;
  name:  string;
  price: number;
  qty:   number;        // NOTE: qty not quantity — matches Supabase orders.items jsonb
  addon?: boolean;
}

export interface Order {
  id:                   string;
  venue_id:             string;
  table_num:            number | null;
  items:                OrderItem[];   // jsonb array from Supabase
  subtotal:             number;
  gst:                  number;
  service_charge:       number;
  total:                number;
  special_instructions: string | null;
  status:               OrderStatus;
  session_id:           string | null;
  table_verified?:      boolean;
  is_advanced_to_deliver?: boolean;
  waiter_delivered?:      boolean;
  created_at:           string;
  updated_at:           string;
}

export interface Venue {
  id:          string;
  slug:        string;
  name:        string;
  zone:        string;
  category:    string;
  description: string;
  tagline:     string;
  hours:       string;
  location:    string;
  status:      string;
  cgst_pct?:   number;
  sgst_pct?:   number;
  service_tax_pct?: number;
}

export interface MenuItem {
  id:              string;
  venue_id:        string;
  name:            string;
  description:     string;
  price:           number;
  category:        string;
  photo_url:       string;
  tag:             string | null;
  available:       boolean;
  sort_order:      number;
  available_from:  string | null;  // "HH:MM" in IST, null = all day
  available_until: string | null;  // "HH:MM" in IST, null = all day
}

export interface VenuePhoto {
  id:         string;
  venue_id:   string;
  url:        string;
  sort_order: number;
  alt_text:   string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received:  'Order Received',
  preparing: 'Preparing',
  ready:     'Payment Received',
  gathering: 'Gathering Cutlery',
  serving:   'Coming to Table',
  delivered: 'Delivered',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'received', 'preparing', 'ready', 'gathering', 'serving', 'delivered',
];
