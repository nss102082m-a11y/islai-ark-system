import { AccountingDetail, CustomerDemographics } from './types';

/**
 * 会計明細データから顧客属性を分析
 */
export function analyzeCustomerDemographics(
  transactions: AccountingDetail[]
): CustomerDemographics {
  console.log('[顧客属性] 分析開始、トランザクション数:', transactions.length);

  const demographics: CustomerDemographics = {
    japanese: { adult: 0, child: 0, infant: 0 },
    western: { adult: 0, child: 0, infant: 0 },
    chinese: { adult: 0, child: 0, infant: 0 },
    korean: { adult: 0, child: 0, infant: 0 },
    hongkong: { adult: 0, child: 0, infant: 0 }
  };

  for (const tx of transactions) {
    for (const item of tx.items) {
      const { category, menu, quantity } = item;

      // 国籍判定（カテゴリー名から）
      const region = detectRegion(category);

      // 年齢判定（メニュー名から）
      const ageGroup = detectAgeGroup(menu);

      // 集計
      demographics[region][ageGroup] += quantity;

      console.log(`[顧客属性] ${category} / ${menu} → ${region} / ${ageGroup} × ${quantity}`);
    }
  }

  console.log('[顧客属性] 分析完了:', demographics);
  return demographics;
}

/**
 * カテゴリー名から国籍を判定
 */
function detectRegion(category: string): keyof CustomerDemographics {
  const lower = category.toLowerCase();

  // 欧米
  if (
    lower.includes('欧米') ||
    lower.includes('western') ||
    lower.includes('foreign')
  ) {
    return 'western';
  }

  // 中国
  if (
    lower.includes('中国') ||
    lower.includes('china') ||
    lower.includes('chinese')
  ) {
    return 'chinese';
  }

  // 韓国
  if (
    lower.includes('韓国') ||
    lower.includes('korea') ||
    lower.includes('korean') ||
    category === 'JINAIR' ||
    lower.includes('jinair')
  ) {
    return 'korean';
  }

  // 香港
  if (
    lower.includes('香港') ||
    lower.includes('hongkong') ||
    lower.includes('hong kong') ||
    category === 'HK' ||
    lower === 'hk'
  ) {
    return 'hongkong';
  }

  // デフォルトは日本
  return 'japanese';
}

/**
 * メニュー名から年齢層を判定
 */
function detectAgeGroup(menu: string): 'adult' | 'child' | 'infant' {
  const lower = menu.toLowerCase();

  // 幼児
  if (
    lower.includes('幼児') ||
    lower.includes('infant') ||
    lower.includes('baby')
  ) {
    return 'infant';
  }

  // 小人・子供
  if (
    lower.includes('小人') ||
    lower.includes('子供') ||
    lower.includes('子ども') ||
    lower.includes('こども') ||
    lower.includes('child') ||
    lower.includes('kid')
  ) {
    return 'child';
  }

  // デフォルトは大人
  return 'adult';
}

/**
 * 分析結果をサマリー形式で取得
 */
export function getCustomerSummary(demographics: CustomerDemographics): {
  totalCustomers: number;
  byRegion: {
    japanese: number;
    western: number;
    chinese: number;
    korean: number;
    hongkong: number;
  };
  byAge: {
    adult: number;
    child: number;
    infant: number;
  };
} {
  const byRegion = {
    japanese: demographics.japanese.adult + demographics.japanese.child + demographics.japanese.infant,
    western: demographics.western.adult + demographics.western.child + demographics.western.infant,
    chinese: demographics.chinese.adult + demographics.chinese.child + demographics.chinese.infant,
    korean: demographics.korean.adult + demographics.korean.child + demographics.korean.infant,
    hongkong: demographics.hongkong.adult + demographics.hongkong.child + demographics.hongkong.infant
  };

  const byAge = {
    adult: demographics.japanese.adult + demographics.western.adult +
           demographics.chinese.adult + demographics.korean.adult + demographics.hongkong.adult,
    child: demographics.japanese.child + demographics.western.child +
           demographics.chinese.child + demographics.korean.child + demographics.hongkong.child,
    infant: demographics.japanese.infant + demographics.western.infant +
            demographics.chinese.infant + demographics.korean.infant + demographics.hongkong.infant
  };

  const totalCustomers = byAge.adult + byAge.child + byAge.infant;

  return {
    totalCustomers,
    byRegion,
    byAge
  };
}
