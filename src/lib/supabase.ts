import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching the DB schema
export type Order = {
  id: string;
  external_id: string | null;
  source: string | null;
  order_number: string | null;
  customer_id: string | null;
  customer_email: string | null;
  subtotal: number | null;
  total_price: number;
  total_tax: number | null;
  total_discounts: number | null;
  currency: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  status: string | null;
  created_at: string;
  customers?: { first_name: string | null; last_name: string | null } | null;
};

export type RevenueSnapshot = {
  id: string;
  date: string;
  source: string | null;
  revenue: number;
  orders_count: number;
  avg_order_value: number;
};

export type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  total_spent: number;
  orders_count: number;
  created_at: string;
};

export type SyncLog = {
  id: string;
  source: string;
  entity: string;
  status: string;
  records_synced: number;
  synced_at: string;
};
