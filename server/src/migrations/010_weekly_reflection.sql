CREATE TABLE IF NOT EXISTS weekly_reflections (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  week_start DATE NOT NULL,
  day_0_status VARCHAR(10) DEFAULT 'none',
  day_1_status VARCHAR(10) DEFAULT 'none',
  day_2_status VARCHAR(10) DEFAULT 'none',
  day_3_status VARCHAR(10) DEFAULT 'none',
  day_4_status VARCHAR(10) DEFAULT 'none',
  day_5_status VARCHAR(10) DEFAULT 'none',
  day_6_status VARCHAR(10) DEFAULT 'none',
  notes TEXT,
  wins TEXT,
  struggles TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);
