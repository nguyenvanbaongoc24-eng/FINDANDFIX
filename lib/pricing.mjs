export function calculateSuggestedPrice({ priceCny, exchangeRate, shippingFeeVnd = 0, purchaseFeeVnd = 0, otherConfirmedCostsVnd = 0, markupPercent = 30 }) {
  const values = [priceCny, exchangeRate, shippingFeeVnd, purchaseFeeVnd, otherConfirmedCostsVnd, markupPercent];
  if (!values.every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new TypeError('Giá và chi phí phải là số không âm.');
  const productCostVnd = Number(priceCny) * Number(exchangeRate);
  const landedCost = productCostVnd + Number(shippingFeeVnd) + Number(purchaseFeeVnd) + Number(otherConfirmedCostsVnd);
  return { productCostVnd, landedCost, markupPercent: Number(markupPercent), suggestedPrice: landedCost * (1 + Number(markupPercent) / 100) };
}
