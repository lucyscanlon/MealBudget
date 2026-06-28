CREATE TABLE IF NOT EXISTS custom_products (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  calories_per_100g NUMERIC NOT NULL,
  protein_per_100g NUMERIC DEFAULT 0,
  carbs_per_100g NUMERIC DEFAULT 0,
  fat_per_100g NUMERIC DEFAULT 0,
  barcode VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
