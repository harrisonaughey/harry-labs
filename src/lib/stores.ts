import { supabase } from "./supabase";

export type Store = {
  id: string;
  shop_domain: string;
  name: string;
  platform: string;
  currency: string;
  is_active: boolean;
  last_synced_at: string | null;
};

export async function getStores(): Promise<Store[]> {
  const { data } = await supabase
    .from("stores")
    .select("id, shop_domain, name, platform, currency, is_active, last_synced_at")
    .eq("is_active", true)
    .order("installed_at", { ascending: true });
  return data ?? [];
}
