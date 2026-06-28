ALTER TABLE plan_entries ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS day_off (
  id SERIAL PRIMARY KEY,
  plan_id INT REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  note VARCHAR(255),
  UNIQUE(plan_id, day_of_week)
);
