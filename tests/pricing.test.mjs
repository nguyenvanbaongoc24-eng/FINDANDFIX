import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSuggestedPrice } from '../lib/pricing.mjs';

test('uses the configured 30 percent markup deterministically', () => {
  const price = calculateSuggestedPrice({ priceCny: 100000 / 3680, exchangeRate: 3680, shippingFeeVnd: 20000 });
  assert.equal(price.productCostVnd, 100000);
  assert.equal(price.landedCost, 120000);
  assert.equal(price.suggestedPrice, 156000);
});
