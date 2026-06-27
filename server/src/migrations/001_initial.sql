CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  daily_calorie_budget INT NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  photo_url VARCHAR(500),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  meal_id INT REFERENCES meals(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  weight_grams NUMERIC NOT NULL,
  calories_per_100g NUMERIC NOT NULL,
  protein_per_100g NUMERIC DEFAULT 0,
  carbs_per_100g NUMERIC DEFAULT 0,
  fat_per_100g NUMERIC DEFAULT 0,
  barcode VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS plan_entries (
  id SERIAL PRIMARY KEY,
  plan_id INT REFERENCES weekly_plans(id) ON DELETE CASCADE,
  meal_id INT REFERENCES meals(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot VARCHAR(20) NOT NULL,
  portion_scale NUMERIC DEFAULT 1.0,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a default user
INSERT INTO users (daily_calorie_budget) VALUES (2000) ON CONFLICT DO NOTHING;
