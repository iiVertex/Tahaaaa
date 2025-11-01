import { useEffect, useMemo, useState } from 'react';
import { getProductsCatalog } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useCoins } from '@/lib/coins';
import qicTerms from '@/data/qic-terms.json';

type Product = { id: string; name: string; base_premium?: number; eligible?: boolean; type?: string };

export default function BundleCalculator({ onStartQuote }:{ onStartQuote?: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const { coins } = useCoins();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savings, setSavings] = useState<any | null>(null);

  useEffect(() => {
    getProductsCatalog().then((p:any)=> setProducts(p || [])).catch(()=> setProducts([]));
  }, []);

  useEffect(() => {
    if (selected.length >= 1) {
      // Calculate bundle savings using QIC terms
      const selectedProducts = products.filter(p => selected.includes(p.id));
      const bundleDiscount = calculateBundleDiscount(selected.length, selectedProducts);
      
      // Calculate coins discount: 1% per 500 coins (capped at reasonable max, e.g., 20%)
      const coinsDiscountPercent = Math.min(20, Math.floor(coins / 500) * 1);
      
      const subtotalCalc = selectedProducts.reduce((s, p) => s + (p.base_premium || 0), 0);
      
      // Calculate discounts separately (additive)
      const bundleSavingsAmount = subtotalCalc * (bundleDiscount / 100);
      const coinsSavingsAmount = subtotalCalc * (coinsDiscountPercent / 100);
      const totalSavingsAmount = bundleSavingsAmount + coinsSavingsAmount;
      
      // Total discount percentage (combined)
      const totalDiscountPercent = bundleDiscount + coinsDiscountPercent;
      const totalAfter = subtotalCalc - totalSavingsAmount;
      
      setSavings({
        savings_percent: (totalDiscountPercent / 100),
        savings_amount: totalSavingsAmount,
        total: totalAfter,
        discount_percentage: totalDiscountPercent,
        bundle_discount_percentage: bundleDiscount,
        coins_discount_percentage: coinsDiscountPercent,
        bundle_savings_amount: bundleSavingsAmount,
        coins_savings_amount: coinsSavingsAmount
      });
    } else {
      setSavings(null);
    }
  }, [selected, products, coins]);

  // Calculate bundle discount based on QIC terms
  const calculateBundleDiscount = (productCount: number, selectedProducts: Product[]) => {
    const bundleRules = qicTerms.bundle_discounts;
    
    // Check for preferred combinations first
    const productTypes = selectedProducts.map(p => p.type || p.id).filter(Boolean);
    if (productTypes.includes('car') && productTypes.includes('home')) {
      return bundleRules.preferred_combinations.car_home.discount;
    }
    if (productTypes.includes('car') && productTypes.includes('travel')) {
      return bundleRules.preferred_combinations.car_travel.discount;
    }
    if (productTypes.includes('health') && productTypes.some(t => t.includes('family'))) {
      return bundleRules.preferred_combinations.health_family.discount;
    }
    
    // Use standard bundle discounts
    if (productCount >= 4) {
      return bundleRules.four_plus_products.discount_percentage;
    } else if (productCount === 3) {
      return bundleRules.three_products.discount_percentage;
    } else if (productCount === 2) {
      return bundleRules.two_products.discount_percentage;
    }
    
    return 0; // No discount for single product
  };

  const subtotal = useMemo(() => {
    return products.filter(p => selected.includes(p.id)).reduce((s, p) => s + (p.base_premium || 0), 0);
  }, [products, selected]);

  const toggle = (id: string) => {
    setSelected((arr) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{t('bundle.title')}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {products.map((p) => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
            <span style={{ opacity: p.eligible === false ? 0.6 : 1 }}>{p.name} — {p.base_premium ?? 0} QAR/mo</span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('bundle.subtotal', { amount: subtotal }) || `Subtotal: ${subtotal} QAR/mo`}</div>
      {savings && (
        <div style={{ display: 'grid', gap: 4, padding: 8, background: 'var(--qic-surface)', borderRadius: 6 }}>
          {/* Bundle Discount (from QIC terms) */}
          {savings.bundle_discount_percentage > 0 && (
            <div style={{ fontSize: 14, color: 'var(--qic-muted)' }}>
              {t('bundle.bundleDiscount', { percent: savings.bundle_discount_percentage }) || 
               `Bundle Discount: ${savings.bundle_discount_percentage}%`}
            </div>
          )}
          
          {/* Coins Discount */}
          {savings.coins_discount_percentage > 0 && (
            <div style={{ fontSize: 14, color: '#FFD700', fontWeight: 600 }}>
              {t('bundle.coinsDiscount', { percent: savings.coins_discount_percentage }) || 
               `Coins Discount: ${savings.coins_discount_percentage}%`}
            </div>
          )}
          
          {/* Total Combined Discount */}
          <div style={{ fontWeight: 600, color: 'var(--qic-accent)', fontSize: 16, marginTop: 4 }}>
            {t('bundle.totalDiscount', { percent: savings.discount_percentage }) || 
             `Total Discount: ${savings.discount_percentage}%`}
          </div>
          
          {/* Savings Breakdown */}
          <div style={{ fontSize: 14, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--qic-border)' }}>
            {savings.bundle_savings_amount > 0 && (
              <div style={{ marginBottom: 4 }}>
                {t('bundle.bundleSavings', { amount: Math.round(savings.bundle_savings_amount) }) || 
                 `Bundle savings: ${Math.round(savings.bundle_savings_amount)} QAR/month`}
              </div>
            )}
            {savings.coins_savings_amount > 0 && (
              <div style={{ marginBottom: 4, color: '#FFD700' }}>
                {t('bundle.coinsSavings', { amount: Math.round(savings.coins_savings_amount) }) || 
                 `Coins savings: ${Math.round(savings.coins_savings_amount)} QAR/month`}
              </div>
            )}
            <div style={{ fontWeight: 600, marginTop: 4 }}>
              {t('bundle.totalSavings', { amount: Math.round(savings.savings_amount) }) || 
               `Total savings: ${Math.round(savings.savings_amount)} QAR/month`}
            </div>
          </div>
          
          {/* Final Total */}
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--qic-border)' }}>
            {t('bundle.totalAfter', { amount: Math.round(savings.total) }) || `Total after discount: ${Math.round(savings.total)} QAR/month`}
          </div>
        </div>
      )}
      <div>
        <button onClick={() => onStartQuote?.(selected)} disabled={selected.length < 1}>{t('quote.cta') || 'Start Quote'}</button>
      </div>
    </div>
  );
}


