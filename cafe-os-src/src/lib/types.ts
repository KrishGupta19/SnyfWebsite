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
}

export interface MenuItem {
  id:          string;
  venue_id:    string;
  name:        string;
  description: string;
  price:       number;
  category:    string;
  photo_url:   string;
  tag:         string | null;
  available:   boolean;
  sort_order:  number;
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
