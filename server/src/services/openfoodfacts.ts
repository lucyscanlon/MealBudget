export interface FoodProduct {
  name: string;
  brand: string;
  imageUrl: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  barcode: string;
}

const OFF_BASE = 'https://world.openfoodfacts.net';
const OFF_HEADERS = {
  'User-Agent': process.env.OFF_USER_AGENT || 'MealBudget/1.0',
};
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = 'DEMO_KEY';

export async function searchByName(query: string): Promise<FoodProduct[]> {
  // Try Open Food Facts UK first
  const offResults = await searchOpenFoodFacts(query);
  if (offResults.length > 0) return offResults;

  // Fallback to USDA
  return searchUSDA(query);
}

async function searchOpenFoodFacts(query: string): Promise<FoodProduct[]> {
  try {
    const res = await fetch(
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments,code,image_front_small_url`,
      { signal: AbortSignal.timeout(8000), headers: OFF_HEADERS }
    );
    if (!res.ok) return [];

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];

    const data = await res.json();
    if (!data.products) return [];

    return data.products
      .filter((p: any) => p.product_name && p.nutriments)
      .map((p: any) => {
        const n = p.nutriments || {};
        return {
          name: p.product_name,
          brand: p.brands || '',
          imageUrl: p.image_front_small_url || null,
          caloriesPer100g: n['energy-kcal_100g'] || 0,
          proteinPer100g: n.proteins_100g || 0,
          carbsPer100g: n.carbohydrates_100g || 0,
          fatPer100g: n.fat_100g || 0,
          barcode: p.code || '',
        };
      });
  } catch {
    return [];
  }
}

async function searchUSDA(query: string): Promise<FoodProduct[]> {
  try {
    const res = await fetch(
      `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=10&dataType=SR%20Legacy,Foundation&api_key=${USDA_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.foods) return [];

    return data.foods.map((food: any) => {
      const get = (name: string) => {
        const nutrient = food.foodNutrients?.find((n: any) => n.nutrientName === name);
        return nutrient?.value || 0;
      };
      const energyKcal = food.foodNutrients?.find(
        (n: any) => n.nutrientName === 'Energy' && n.unitName === 'KCAL'
      )?.value || 0;
      return {
        name: food.description || 'Unknown',
        brand: food.brandName || food.brandOwner || '',
        imageUrl: null,
        caloriesPer100g: energyKcal,
        proteinPer100g: get('Protein'),
        carbsPer100g: get('Carbohydrate, by difference'),
        fatPer100g: get('Total lipid (fat)'),
        barcode: '',
      };
    });
  } catch {
    return [];
  }
}

export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  try {
    const res = await fetch(
      `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { signal: AbortSignal.timeout(8000), headers: OFF_HEADERS }
    );
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const nutrients = p.nutriments || {};

    return {
      name: p.product_name || p.generic_name || 'Unknown product',
      brand: p.brands || '',
      imageUrl: p.image_front_small_url || null,
      caloriesPer100g: nutrients['energy-kcal_100g'] || 0,
      proteinPer100g: nutrients.proteins_100g || 0,
      carbsPer100g: nutrients.carbohydrates_100g || 0,
      fatPer100g: nutrients.fat_100g || 0,
      barcode,
    };
  } catch {
    return null;
  }
}
