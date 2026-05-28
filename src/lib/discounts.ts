export type DiscountInfo = {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  appliedSource: 'article' | 'category' | 'general' | 'none';
  discountType: 'percentage' | 'amount' | 'none';
  discountValue: number;
};

/**
 * Calcula el descuento aplicable a un artículo basado en las reglas de prioridad
 * y override por ahorro.
 * 
 * Prioridad por defecto: Artículo > Categoría > General.
 * Excepción: Si un nivel inferior da más ahorro, se aplica ese nivel.
 * En caso de empate en ahorro, se aplica la mayor prioridad.
 */
export function calculateDiscount(
  price: number | string,
  articleDiscountType: string | null | undefined,
  articleDiscountValue: number | string | null | undefined,
  categoryDiscountPercent: number | string | null | undefined,
  generalDiscountPercent: number | string | null | undefined
): DiscountInfo {
  const originalPrice = Number(price) || 0;
  if (originalPrice <= 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      appliedSource: 'none',
      discountType: 'none',
      discountValue: 0
    };
  }

  // 1. Ahorro por descuento de artículo
  let sArticle = 0;
  const artVal = Number(articleDiscountValue) || 0;
  if (articleDiscountType === 'percentage' && artVal > 0) {
    sArticle = originalPrice * (artVal / 100);
  } else if (articleDiscountType === 'amount' && artVal > 0) {
    sArticle = artVal;
  }

  // 2. Ahorro por descuento de categoría
  let sCategory = 0;
  const catPercent = Number(categoryDiscountPercent) || 0;
  if (catPercent > 0) {
    sCategory = originalPrice * (catPercent / 100);
  }

  // 3. Ahorro por descuento general
  let sGeneral = 0;
  const genPercent = Number(generalDiscountPercent) || 0;
  if (genPercent > 0) {
    sGeneral = originalPrice * (genPercent / 100);
  }

  // Selección del descuento máximo con desempate por prioridad (Artículo > Categoría > General)
  let maxSavings = sArticle;
  let appliedSource: 'article' | 'category' | 'general' | 'none' = sArticle > 0 ? 'article' : 'none';
  let discountAmount = sArticle;
  let discountType: 'percentage' | 'amount' | 'none' = 'none';
  let discountValue = 0;

  if (sArticle > 0) {
    discountType = articleDiscountType as 'percentage' | 'amount';
    discountValue = artVal;
  }

  // Categoría tiene prioridad inferior a Artículo, pero sobreescribe si el ahorro es estrictamente superior
  if (sCategory > maxSavings) {
    maxSavings = sCategory;
    appliedSource = 'category';
    discountAmount = sCategory;
    discountType = 'percentage';
    discountValue = catPercent;
  }

  // General tiene prioridad inferior a Categoría, pero sobreescribe si el ahorro es estrictamente superior
  if (sGeneral > maxSavings) {
    maxSavings = sGeneral;
    appliedSource = 'general';
    discountAmount = sGeneral;
    discountType = 'percentage';
    discountValue = genPercent;
  }

  if (maxSavings <= 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      appliedSource: 'none',
      discountType: 'none',
      discountValue: 0
    };
  }

  // Redondeo a céntimos y cálculo final
  const roundedDiscount = Math.round(discountAmount * 100) / 100;
  const finalPrice = Math.max(0, Math.round((originalPrice - roundedDiscount) * 100) / 100);

  return {
    originalPrice,
    finalPrice,
    discountAmount: roundedDiscount,
    appliedSource,
    discountType,
    discountValue
  };
}
