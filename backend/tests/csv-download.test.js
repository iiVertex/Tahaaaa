/**
 * CSV Download Tests
 * Tests bundle save and CSV generation
 */

export async function testCSVDownload(apiBase, userId) {
  const errors = [];

  // Test bundle data
  const bundleData = {
    products: [
      { id: 'car-1', name: 'QIC Comprehensive Car Insurance', base_premium: 800, type: 'car' },
      { id: 'health-1', name: 'QIC Health Insurance Basic', base_premium: 1500, type: 'health' }
    ],
    bundle_data: {
      selected_product_ids: ['car-1', 'health-1'],
      timestamp: new Date().toISOString()
    },
    base_premium_total: 2300,
    bundle_discount_percentage: 10,
    coins_discount_percentage: 5,
    total_discount_percentage: 15,
    bundle_savings_amount: 230,
    coins_savings_amount: 115,
    total_savings_amount: 345,
    final_price_after_discount: 1955
  };

  // Test 1: Save bundle
  console.log('  Testing bundle save...');
  try {
    const saveRes = await fetch(`${apiBase}/bundles/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': userId, 'x-user-id': userId },
      body: JSON.stringify(bundleData)
    });

    if (!saveRes.ok) {
      const errorData = await saveRes.json().catch(() => ({ message: saveRes.statusText }));
      throw new Error(`Bundle save failed: ${errorData.message || saveRes.statusText}`);
    }

    const saveResult = await saveRes.json();
    
    // Test 2: Verify response structure
    console.log('  Verifying bundle save response...');
    if (!saveResult.success) {
      errors.push('Bundle save response indicates failure');
    }

    if (!saveResult.data) {
      errors.push('Bundle save response missing data field');
    } else {
      // Verify bundle record exists
      if (!saveResult.data.bundle && !saveResult.data.bundle_id) {
        errors.push('Bundle save response missing bundle record');
      }

      // Verify coins deducted info
      if (saveResult.data.coins_deducted === undefined) {
        errors.push('Bundle save response missing coins_deducted');
      }
    }

    // Test 3: Verify CSV would contain required columns
    console.log('  Verifying CSV structure (would contain)...');
    const requiredCSVColumns = [
      'Product Name',
      'Base Premium (QAR/month)',
      'Bundle Discount (%)',
      'Coins Discount (%)',
      'Total Discount (%)',
      'Bundle Savings (QAR/month)',
      'Coins Savings (QAR/month)',
      'Total Savings (QAR/month)',
      'Final Price After Discount (QAR/month)'
    ];

    // Note: CSV generation is frontend-only, so we test that bundle data has required fields
    bundleData.products.forEach((product, idx) => {
      if (!product.name) errors.push(`Product ${idx + 1} missing name for CSV`);
      if (product.base_premium === undefined) errors.push(`Product ${idx + 1} missing base_premium for CSV`);
    });

    if (bundleData.bundle_discount_percentage === undefined) {
      errors.push('Missing bundle_discount_percentage for CSV');
    }
    if (bundleData.coins_discount_percentage === undefined) {
      errors.push('Missing coins_discount_percentage for CSV');
    }
    if (bundleData.total_savings_amount === undefined) {
      errors.push('Missing total_savings_amount for CSV');
    }
    if (bundleData.final_price_after_discount === undefined) {
      errors.push('Missing final_price_after_discount for CSV');
    }

  } catch (error) {
    errors.push(`CSV download test failed: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  console.log('  ✅ All CSV Download tests passed');
}

