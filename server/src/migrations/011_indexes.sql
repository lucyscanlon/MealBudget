-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_meal_id ON ingredients(meal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week ON weekly_plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_plan_entries_plan_id ON plan_entries(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_entries_day ON plan_entries(plan_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_id ON weight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_products_barcode ON custom_products(barcode);
CREATE INDEX IF NOT EXISTS idx_custom_products_name ON custom_products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_weekly_reflections_user_week ON weekly_reflections(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_day_off_plan ON day_off(plan_id);
