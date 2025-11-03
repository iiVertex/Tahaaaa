import { useEffect, useMemo, useState } from 'react';
import { getProductsCatalog, saveBundle } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useCoins } from '@/lib/coins';
import { useToast } from '@/components/Toast';
import qicTerms from '@/data/qic-terms.json';

type Product = { id: string; name: string; base_premium?: number; eligible?: boolean; type?: string };

export default function BundleCalculator({ onStartQuote }:{ onStartQuote?: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const { coins, refreshCoins } = useCoins();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savings, setSavings] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProductsCatalog().then((p:any)=> setProducts(p || [])).catch(()=> setProducts([]));
  }, []);

  useEffect(() => {
    if (selected.length >= 1) {
      // Calculate bundle savings using QIC terms
      const selectedProducts = products.filter(p => selected.includes(p.id));
      const bundleDiscount = calculateBundleDiscount(selected.length, selectedProducts);
      
      // Calculate coins discount: 1% per 100 coins (capped at reasonable max, e.g., 20%)
      const coinsDiscountPercent = Math.min(20, Math.floor(coins / 100) * 1);
      
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
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button 
          onClick={async () => {
            if (!savings || selected.length === 0) return;
            setSaving(true);
            try {
              const selectedProducts = products.filter(p => selected.includes(p.id));
              const bundleData = {
                products: selectedProducts.map(p => ({
                  id: p.id,
                  name: p.name,
                  base_premium: p.base_premium || 0,
                  type: p.type
                })),
                bundle_data: {
                  selected_product_ids: selected,
                  timestamp: new Date().toISOString()
                },
                base_premium_total: savings.total + savings.savings_amount, // Reconstruct subtotal
                bundle_discount_percentage: savings.bundle_discount_percentage || 0,
                coins_discount_percentage: savings.coins_discount_percentage || 0,
                total_discount_percentage: savings.discount_percentage || 0,
                bundle_savings_amount: savings.bundle_savings_amount || 0,
                coins_savings_amount: savings.coins_savings_amount || 0,
                total_savings_amount: savings.savings_amount || 0,
                final_price_after_discount: savings.total || 0
              };

              const result = await saveBundle(bundleData);
              
              // Generate and download CSV - with error handling
              try {
                generateCSV(bundleData, result);
              } catch (csvError: any) {
                console.error('CSV generation failed:', csvError);
                toast?.error?.('CSV download failed', csvError?.message || 'Unable to generate CSV file');
              }
              
              // Refresh coins
              await refreshCoins();
              
              toast?.success?.('Bundle saved!', `Coins deducted. CSV downloaded.`);
            } catch (error: any) {
              toast?.error?.('Failed to save bundle', error?.message || 'Unknown error');
            } finally {
              setSaving(false);
            }
          }}
          disabled={selected.length < 1 || !savings || saving}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: savings ? 'var(--qic-secondary)' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: savings && !saving ? 'pointer' : 'not-allowed',
            opacity: (savings && !saving) ? 1 : 0.6
          }}
        >
          {saving ? (t('saving') || 'Saving...') : (savings ? `Save ${Math.round(savings.discount_percentage || 0)}%` : (t('bundle.save') || 'Save Bundle Estimate'))}
        </button>
        <button 
          onClick={async () => {
            if (selected.length < 1 || !savings) return;
            try {
              // Generate CSV for quote estimate (without saving bundle)
              const selectedProducts = products.filter(p => selected.includes(p.id));
              const quoteData = {
                products: selectedProducts.map(p => ({
                  id: p.id,
                  name: p.name,
                  base_premium: p.base_premium || 0,
                  type: p.type
                })),
                bundle_data: {
                  selected_product_ids: selected,
                  timestamp: new Date().toISOString(),
                  is_quote: true // Mark as quote, not saved bundle
                },
                base_premium_total: savings.total + savings.savings_amount,
                bundle_discount_percentage: savings.bundle_discount_percentage || 0,
                coins_discount_percentage: savings.coins_discount_percentage || 0,
                total_discount_percentage: savings.discount_percentage || 0,
                bundle_savings_amount: savings.bundle_savings_amount || 0,
                coins_savings_amount: savings.coins_savings_amount || 0,
                total_savings_amount: savings.savings_amount || 0,
                final_price_after_discount: savings.total || 0
              };
              
              // Generate and download CSV for quote
              generateCSV(quoteData, { data: { coins_deducted: 0, remaining_coins: coins } });
              
              // Also open quote drawer if handler provided
              if (onStartQuote) {
                onStartQuote(selected);
              }
              
              toast?.success?.('Quote generated!', 'CSV downloaded with pricing details.');
            } catch (error: any) {
              toast?.error?.('Failed to generate quote', error?.message || 'Unable to generate CSV');
            }
          }}
          disabled={selected.length < 1 || !savings}
          style={{
            padding: '10px 16px',
            background: (selected.length >= 1 && savings) ? 'var(--qic-primary)' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: (selected.length >= 1 && savings) ? 'pointer' : 'not-allowed',
            opacity: (selected.length >= 1 && savings) ? 1 : 0.6
          }}
        >
          {t('quote.cta') || 'Get Quote'}
        </button>
      </div>
    </div>
  );
}

function generateCSV(bundleData: any, saveResult: any) {
  // Validate bundleData
  if (!bundleData || !bundleData.products || !Array.isArray(bundleData.products)) {
    throw new Error('Invalid bundle data: products array is required');
  }
  
  if (bundleData.products.length === 0) {
    throw new Error('No products selected for bundle');
  }
  
  const rows: string[][] = [];
  
  // Header row
  rows.push([
    'Product Name',
    'Base Premium (QAR/month)',
    'Bundle Discount (%)',
    'Coins Discount (%)',
    'Total Discount (%)',
    'Bundle Savings (QAR/month)',
    'Coins Savings (QAR/month)',
    'Total Savings (QAR/month)',
    'Final Price After Discount (QAR/month)'
  ]);
  
  // Calculate per-product breakdown with defaults
  const basePremiumTotal = bundleData.base_premium_total || 0;
  const bundleDiscountPercent = bundleData.bundle_discount_percentage || 0;
  const coinsDiscountPercent = bundleData.coins_discount_percentage || 0;
  const totalDiscountPercent = bundleData.total_discount_percentage || 0;
  const bundleSavingsAmount = bundleData.bundle_savings_amount || 0;
  const coinsSavingsAmount = bundleData.coins_savings_amount || 0;
  const totalSavingsAmount = bundleData.total_savings_amount || 0;
  const finalPrice = bundleData.final_price_after_discount || 0;
  
  // Add product rows - validate each product has required fields
  bundleData.products.forEach((product: any) => {
    if (!product) {
      console.warn('Skipping invalid product in CSV generation');
      return;
    }
    const productBasePremium = Number(product.base_premium) || 0;
    const productBundleSavings = (productBasePremium * bundleDiscountPercent) / 100;
    const productCoinsSavings = (productBasePremium * coinsDiscountPercent) / 100;
    const productTotalSavings = productBundleSavings + productCoinsSavings;
    const productFinalPrice = productBasePremium - productTotalSavings;
    
    rows.push([
      product.name || product.id,
      productBasePremium.toFixed(2),
      bundleDiscountPercent.toFixed(2),
      coinsDiscountPercent.toFixed(2),
      totalDiscountPercent.toFixed(2),
      productBundleSavings.toFixed(2),
      productCoinsSavings.toFixed(2),
      productTotalSavings.toFixed(2),
      productFinalPrice.toFixed(2)
    ]);
  });
  
  // Add summary row
  rows.push([]);
  rows.push(['TOTALS', '', '', '', '', '', '', '', '']);
  rows.push([
    'Total Combined',
    basePremiumTotal.toFixed(2),
    bundleDiscountPercent.toFixed(2),
    coinsDiscountPercent.toFixed(2),
    totalDiscountPercent.toFixed(2),
    bundleSavingsAmount.toFixed(2),
    coinsSavingsAmount.toFixed(2),
    totalSavingsAmount.toFixed(2),
    finalPrice.toFixed(2)
  ]);
  
  // Add metadata rows
  rows.push([]);
  rows.push(['Metadata', '', '', '', '', '', '', '', '']);
  rows.push(['Date Generated', new Date().toISOString(), '', '', '', '', '', '', '']);
  rows.push(['Coins Deducted', (saveResult?.data?.coins_deducted || 0).toString(), '', '', '', '', '', '', '']);
  rows.push(['Remaining Coins', (saveResult?.data?.remaining_coins || 0).toString(), '', '', '', '', '', '', '']);
  
  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  // Create blob and download
  const isQuote = bundleData.bundle_data?.is_quote || false;
  const filename = isQuote 
    ? `qic-quote-${new Date().toISOString().split('T')[0]}.csv`
    : `qic-bundle-${new Date().toISOString().split('T')[0]}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  
  // Trigger download with timeout to ensure it happens
  setTimeout(() => {
    try {
      link.click();
      // Cleanup after a delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (downloadError) {
      console.error('CSV download trigger failed:', downloadError);
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      throw new Error('Failed to trigger CSV download');
    }
  }, 0);
}


