-- Order line items (product-level revenue breakdown)
CREATE TABLE IF NOT EXISTS order_line_items (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id          text,
  external_id       text,            -- shopify line item id
  order_external_id text,            -- shopify order id
  product_id        text,
  product_title     text,
  variant_title     text,
  sku               text,
  price             decimal(10,2),
  quantity          integer,
  total_price       decimal(10,2),
  UNIQUE (store_id, external_id)
);
CREATE INDEX IF NOT EXISTS order_line_items_store_id_idx   ON order_line_items (store_id);
CREATE INDEX IF NOT EXISTS order_line_items_product_id_idx ON order_line_items (product_id);
CREATE INDEX IF NOT EXISTS order_line_items_order_ext_idx  ON order_line_items (store_id, order_external_id);
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role full access" ON order_line_items USING (true) WITH CHECK (true);

-- Store adjustments (change log with metric snapshots)
CREATE TABLE IF NOT EXISTS store_adjustments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        text,
  logged_at       timestamptz DEFAULT now(),
  category        text        NOT NULL CHECK (category IN ('price','product','promo','inventory','store','shipping','ads','other')),
  title           text        NOT NULL,
  description     text,
  metric_snapshot jsonb       DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_adjustments_store_id_idx  ON store_adjustments (store_id);
CREATE INDEX IF NOT EXISTS store_adjustments_logged_at_idx ON store_adjustments (logged_at DESC);
ALTER TABLE store_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role full access" ON store_adjustments USING (true) WITH CHECK (true);
