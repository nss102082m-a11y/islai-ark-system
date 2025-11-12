// CSV解析機能のテストコード（開発用）
import {
  parseAccountingDetailCSV,
  parseSalesSummaryCSV,
  analyzeCustomerDemographics,
  type AccountingDetail,
  type SalesSummary,
  type CustomerDemographics
} from './index';

/**
 * 会計明細CSVのテスト
 */
export async function testAccountingParser() {
  console.log('=== 会計明細パーサーテスト ===');

  // テスト用CSVデータ（実際の形式）
  const testCSV = `伝票番号,来店日,来店時間,会計日,会計時間,合計,小計,内消費税,現金,クレジット,交通系,QUICPay,iD,QR,PayPay,売掛,おつり,客数,商品数,商品ID1,カテゴリー名1,メニュー名1,単価1,数量1
TEST001,2024/10/31,10:00,2024/10/31,10:15,1700,1545,155,1700,0,0,0,0,0,0,0,0,2,1,ITEM001,フリー料金(日本),大人,1700,1`;

  // Blobに変換
  const blob = new Blob([testCSV], { type: 'text/csv' });
  const file = new File([blob], 'test.csv', { type: 'text/csv' });

  try {
    const result = await parseAccountingDetailCSV(file);

    console.log('パース結果:', result.success ? '✅ 成功' : '❌ 失敗');
    console.log('データ件数:', result.data?.length || 0);
    console.log('エラー数:', result.errors.length);

    if (result.data && result.data.length > 0) {
      console.log('サンプルデータ:', result.data[0]);
    }

    if (result.errors.length > 0) {
      console.error('エラー詳細:', result.errors);
    }

    return result;
  } catch (error) {
    console.error('テスト失敗:', error);
    return null;
  }
}

/**
 * 売上集計CSVのテスト
 */
export async function testSalesParser() {
  console.log('=== 売上集計パーサーテスト ===');

  // テスト用CSVデータ
  const testCSV = `集計期間,売上（税込）,会計数,会計単価,客数,客単価,商品数,現金,クレジット,交通系,QUICPay,iD,QR,PayPay,売掛,売上（10%標準）,返品数,返金額
2024/10/31,150000,50,3000,100,1500,120,80000,70000,0,0,0,0,0,0,150000,0,0`;

  const blob = new Blob([testCSV], { type: 'text/csv' });
  const file = new File([blob], 'test_sales.csv', { type: 'text/csv' });

  try {
    const result = await parseSalesSummaryCSV(file);

    console.log('パース結果:', result.success ? '✅ 成功' : '❌ 失敗');
    console.log('データ件数:', result.data?.length || 0);
    console.log('エラー数:', result.errors.length);

    if (result.data && result.data.length > 0) {
      console.log('サンプルデータ:', result.data[0]);
    }

    return result;
  } catch (error) {
    console.error('テスト失敗:', error);
    return null;
  }
}

/**
 * 顧客属性分析のテスト
 */
export function testCustomerAnalysis() {
  console.log('=== 顧客属性分析テスト ===');

  // テスト用トランザクションデータ
  const testData: AccountingDetail[] = [
    {
      transactionNo: 'TEST001',
      visitDate: '2024-10-31',
      visitTime: '10:00',
      accountingDate: '2024-10-31',
      accountingTime: '10:15',
      total: 5100,
      subtotal: 4636,
      consumptionTax: 464,
      cash: 5100,
      creditCard: 0,
      transit: 0,
      quicpay: 0,
      id: 0,
      qr: 0,
      payPay: 0,
      accountsReceivable: 0,
      change: 0,
      customerCount: 3,
      itemCount: 3,
      items: [
        { id: 'ITEM001', category: 'フリー料金(日本)', menu: '大人', price: 1700, quantity: 2 },
        { id: 'ITEM002', category: 'フリー料金(日本)', menu: '小人', price: 850, quantity: 1 }
      ]
    },
    {
      transactionNo: 'TEST002',
      visitDate: '2024-10-31',
      visitTime: '11:00',
      accountingDate: '2024-10-31',
      accountingTime: '11:15',
      total: 3400,
      subtotal: 3091,
      consumptionTax: 309,
      cash: 0,
      creditCard: 3400,
      transit: 0,
      quicpay: 0,
      id: 0,
      qr: 0,
      payPay: 0,
      accountsReceivable: 0,
      change: 0,
      customerCount: 2,
      itemCount: 2,
      items: [
        { id: 'ITEM003', category: '欧米', menu: 'Adult', price: 1700, quantity: 2 }
      ]
    }
  ];

  const demographics = analyzeCustomerDemographics(testData);

  console.log('分析結果:');
  console.log('- 日本人 大人:', demographics.japanese.adult);
  console.log('- 日本人 小人:', demographics.japanese.child);
  console.log('- 欧米人 大人:', demographics.western.adult);
  console.log('合計:',
    demographics.japanese.adult + demographics.japanese.child +
    demographics.western.adult + demographics.western.child +
    demographics.chinese.adult + demographics.chinese.child +
    demographics.korean.adult + demographics.korean.child +
    demographics.hongkong.adult + demographics.hongkong.child
  );

  return demographics;
}

/**
 * すべてのテストを実行
 */
export async function runAllTests() {
  console.log('🧪 CSV解析エンジン - 全テスト実行');
  console.log('=====================================');

  // Test 1: 会計明細パーサー
  await testAccountingParser();
  console.log('');

  // Test 2: 売上集計パーサー
  await testSalesParser();
  console.log('');

  // Test 3: 顧客属性分析
  testCustomerAnalysis();
  console.log('');

  console.log('=====================================');
  console.log('✅ すべてのテスト完了');
}
