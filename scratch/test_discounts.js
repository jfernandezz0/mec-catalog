// Copy calculateDiscount function directly for local testing
function calculateDiscount(
  price,
  articleDiscountType,
  articleDiscountValue,
  categoryDiscountPercent,
  generalDiscountPercent
) {
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
  let appliedSource = sArticle > 0 ? 'article' : 'none';
  let discountAmount = sArticle;
  let discountType = 'none';
  let discountValue = 0;

  if (sArticle > 0) {
    discountType = articleDiscountType;
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

const tests = [
  {
    name: "Example 1: general 5%, Germany 10%, Audi R8 LMS 25% -> (apply 25% of article)",
    price: 100,
    artType: 'percentage', artVal: 25,
    catPercent: 10, genPercent: 5,
    expectedApplied: 'article', expectedFinal: 75
  },
  {
    name: "Example 2: general none, France 10%, Renault 5 Turbo none -> (apply 10% of category)",
    price: 100,
    artType: null, artVal: null,
    catPercent: 10, genPercent: null,
    expectedApplied: 'category', expectedFinal: 90
  },
  {
    name: "Example 3: general 5%, Italy none, Ferrari F40 5% -> (apply 5% of article)",
    price: 100,
    artType: 'percentage', artVal: 5,
    catPercent: 0, genPercent: 5,
    expectedApplied: 'article', expectedFinal: 95
  },
  {
    name: "Override case: general 15%, Category 10%, Article 5% -> (apply 15% general override)",
    price: 100,
    artType: 'percentage', artVal: 5,
    catPercent: 10, genPercent: 15,
    expectedApplied: 'general', expectedFinal: 85
  },
  {
    name: "Override case with amount: Article 5€, Category 10%, price 40€ -> (apply 5€ article discount as it is 12.5% saving vs 10%)",
    price: 40,
    artType: 'amount', artVal: 5,
    catPercent: 10, genPercent: 0,
    expectedApplied: 'article', expectedFinal: 35
  },
  {
    name: "Override case with amount: Article 5€, Category 20%, price 40€ -> (apply 20% category discount since 8€ is greater than 5€)",
    price: 40,
    artType: 'amount', artVal: 5,
    catPercent: 20, genPercent: 0,
    expectedApplied: 'category', expectedFinal: 32
  }
];

let failed = false;
for (const t of tests) {
  const res = calculateDiscount(t.price, t.artType, t.artVal, t.catPercent, t.genPercent);
  const success = res.appliedSource === t.expectedApplied && res.finalPrice === t.expectedFinal;
  console.log(`${success ? '✅' : '❌'} ${t.name}`);
  if (!success) {
    failed = true;
    console.log("   Result:", res);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("All discount calculation tests passed successfully!");
}
