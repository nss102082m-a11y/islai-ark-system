import React, { useState } from 'react';
import { FileText, Play, CheckCircle, XCircle } from 'lucide-react';
import {
  parseAccountingDetailCSV,
  parseSalesSummaryCSV,
  analyzeCustomerDemographics,
  type AccountingDetail,
  type ParseResult
} from '../utils/csv';

export default function CSVTestPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    setTestResults(prev => [...prev, message]);
    console.log(message);
  };

  const testAccountingParser = async () => {
    addLog('=== 会計明細パーサーテスト ===');

    const testCSV = `伝票番号,来店日,来店時間,会計日,会計時間,合計,小計,内消費税,現金,クレジット,交通系,QUICPay,iD,QR,PayPay,売掛,おつり,客数,商品数,商品ID1,カテゴリー名1,メニュー名1,単価1,数量1
TEST001,2024/10/31,10:00,2024/10/31,10:15,1700,1545,155,1700,0,0,0,0,0,0,0,0,2,1,ITEM001,フリー料金(日本),大人,1700,1`;

    const blob = new Blob([testCSV], { type: 'text/csv' });
    const file = new File([blob], 'test.csv', { type: 'text/csv' });

    try {
      const result = await parseAccountingDetailCSV(file);

      addLog(`パース結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
      addLog(`データ件数: ${result.data?.length || 0}`);
      addLog(`エラー数: ${result.errors.length}`);

      if (result.data && result.data.length > 0) {
        addLog(`サンプルデータ: ${JSON.stringify(result.data[0], null, 2)}`);
      }

      if (result.errors.length > 0) {
        addLog(`エラー詳細: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result;
    } catch (error) {
      addLog(`❌ テスト失敗: ${error}`);
      return null;
    }
  };

  const testSalesParser = async () => {
    addLog('\n=== 売上集計パーサーテスト ===');

    const testCSV = `集計期間,売上（税込）,会計数,会計単価,客数,客単価,商品数,現金,クレジット,交通系,QUICPay,iD,QR,PayPay,売掛,売上（10%標準）,返品数,返金額
2024/10/31,150000,50,3000,100,1500,120,80000,70000,0,0,0,0,0,0,150000,0,0`;

    const blob = new Blob([testCSV], { type: 'text/csv' });
    const file = new File([blob], 'test_sales.csv', { type: 'text/csv' });

    try {
      const result = await parseSalesSummaryCSV(file);

      addLog(`パース結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
      addLog(`データ件数: ${result.data?.length || 0}`);
      addLog(`エラー数: ${result.errors.length}`);

      if (result.data && result.data.length > 0) {
        addLog(`サンプルデータ: ${JSON.stringify(result.data[0], null, 2)}`);
      }

      return result;
    } catch (error) {
      addLog(`❌ テスト失敗: ${error}`);
      return null;
    }
  };

  const testCustomerAnalysis = () => {
    addLog('\n=== 顧客属性分析テスト ===');

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

    addLog('分析結果:');
    addLog(`- 日本人 大人: ${demographics.japanese.adult}`);
    addLog(`- 日本人 小人: ${demographics.japanese.child}`);
    addLog(`- 欧米人 大人: ${demographics.western.adult}`);

    const total =
      demographics.japanese.adult + demographics.japanese.child +
      demographics.western.adult + demographics.western.child +
      demographics.chinese.adult + demographics.chinese.child +
      demographics.korean.adult + demographics.korean.child +
      demographics.hongkong.adult + demographics.hongkong.child;

    addLog(`合計: ${total}名`);

    return demographics;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    addLog('🧪 CSV解析エンジン - 全テスト実行');
    addLog('=====================================');

    await testAccountingParser();
    await new Promise(resolve => setTimeout(resolve, 500));

    await testSalesParser();
    await new Promise(resolve => setTimeout(resolve, 500));

    testCustomerAnalysis();

    addLog('\n=====================================');
    addLog('✅ すべてのテスト完了');

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-teal-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                CSV解析エンジン - テストページ
              </h1>
              <p className="text-sm text-gray-600">
                開発用テスト（本番では非表示）
              </p>
            </div>
          </div>

          <div className="mb-6">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-5 h-5" />
              {isRunning ? 'テスト実行中...' : 'すべてのテストを実行'}
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-auto max-h-[600px]">
            {testResults.length === 0 ? (
              <div className="text-gray-500">
                「すべてのテストを実行」ボタンをクリックしてください
              </div>
            ) : (
              testResults.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">
              📝 テスト内容
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ 会計明細CSVのパース（商品詳細含む）</li>
              <li>✅ 売上集計CSVのパース</li>
              <li>✅ 顧客属性分析（国籍・年齢層判定）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
