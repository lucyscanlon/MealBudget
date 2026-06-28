export interface TescoProduct {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  barcode: string;
  imageUrl: string | null;
}

export async function lookupTescoUrl(url: string): Promise<TescoProduct | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    const titleMatch = html.match(/"title":"([^"]+)"/);
    const name = titleMatch ? titleMatch[1] : 'Unknown product';

    const gtinMatch = html.match(/"gtin13":"(\d+)"/) || html.match(/"gtin":"(\d+)"/);
    const barcode = gtinMatch ? gtinMatch[1] : '';

    // Parse per 100g nutrition
    const nutritionMatches = html.matchAll(/"name":"(Energy|Fat|Carbohydrate|Protein|Salt|Fibre)","value1":"([^"]+)","value2":"([^"]+)"/g);

    let caloriesPer100g = 0;
    let proteinPer100g = 0;
    let carbsPer100g = 0;
    let fatPer100g = 0;

    for (const match of nutritionMatches) {
      const [, nutrient, perServing, per100g] = match;
      const value = parseFloat(per100g.replace(/[^0-9.]/g, '')) || 0;

      switch (nutrient) {
        case 'Energy': {
          const kcalMatch = per100g.match(/(\d+)kcal/);
          if (kcalMatch) caloriesPer100g = parseInt(kcalMatch[1]);
          break;
        }
        case 'Protein': proteinPer100g = value; break;
        case 'Carbohydrate': carbsPer100g = value; break;
        case 'Fat': fatPer100g = value; break;
      }
    }

    // Fallback: parse from "Typical values per 100g" text
    if (caloriesPer100g === 0) {
      const typicalMatch = html.match(/per 100g: Energy (\d+)kJ \/ (\d+)kcal/);
      if (typicalMatch) caloriesPer100g = parseInt(typicalMatch[2]);
    }

    const imgMatch = html.match(/"image":"(https:\/\/[^"]+\.(?:jpeg|jpg|png)[^"]*)"/);
    const imageUrl = imgMatch ? imgMatch[1].replace(/\\u002F/g, '/') : null;

    return { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, barcode, imageUrl };
  } catch {
    return null;
  }
}
