import { SalesSummary, ParseResult, CSVParseError } from './types';
import {
  convertShiftJISToUTF8,
  parseCSVToArray,
  validateHeaders,
  parseNumber,
  formatDate
} from './csvParser';

/**
 * 売上集計CSVの必須ヘッダー
 */
const REQUIRED_HEADERS = [
  '集計期間',
  '売上',
  '会計数',
  '客数'
];

/**
 * 売上集計CSVをパース
 */
export async function parseSalesSummaryCSV(
  file: File
): Promise<ParseResult<SalesSummary[]>> {
  console.log('[売上集計] パース開始:', file.name);

  const errors: CSVParseError[] = [];
  const warnings: string[] = [];

  try {
    // Step 1: Shift-JIS → UTF-8変換
    const csvText = await convertShiftJISToUTF8(file);

    // Step 2: CSV配列化
    const rows = parseCSVToArray(csvText);

    if (rows.length < 2) {
      return {
        success: false,
        data: null,
        errors: [{ row: 0, column: '', value: '', message: 'CSVが空です' }],
        warnings: []
      };
    }

    // Step 3: ヘッダー検証
    const headers = rows[0];
    const headerErrors = validateHeaders(headers, REQUIRED_HEADERS);

    if (headerErrors.length > 0) {
      return {
        success: false,
        data: null,
        errors: headerErrors,
        warnings: []
      };
    }

    // Step 4: データ行をパース
    const data: SalesSummary[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      try {
        const summary = parseSalesSummaryRow(headers, row, i);
        if (summary) {
          data.push(summary);
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          column: '',
          value: '',
          message: `行のパースエラー: ${error}`
        });
      }
    }

    console.log('[売上集計] パース完了:', data.length, '件');

    return {
      success: errors.length === 0,
      data,
      errors,
      warnings
    };

  } catch (error) {
    console.error('[売上集計] パース失敗:', error);
    return {
      success: false,
      data: null,
      errors: [{ row: 0, column: '', value: '', message: `${error}` }],
      warnings: []
    };
  }
}

/**
 * 1行をSalesSummaryオブジェクトに変換
 */
function parseSalesSummaryRow(
  headers: string[],
  row: string[],
  rowIndex: number
): SalesSummary | null {
  const getCell = (header: string): string => {
    const index = headers.indexOf(header);
    return index >= 0 ? row[index] : '';
  };

  // 集計期間（日付）
  const dateStr = getCell('集計期間');
  if (!dateStr) {
    console.warn(`[売上集計] 行${rowIndex + 1}: 日付が空です`);
    return null;
  }

  const date = formatDate(dateStr);

  // 売上
  const total = parseNumber(getCell('売上'));
  const transactionCount = parseNumber(getCell('会計数'));
  const avgPerTransaction = parseNumber(getCell('会計単価'));
  const customerCount = parseNumber(getCell('客数'));
  const avgPerCustomer = parseNumber(getCell('客単価'));
  const itemCount = parseNumber(getCell('商品数'));

  // 支払方法別
  const paymentMethods = {
    cash: parseNumber(getCell('現金')),
    creditCard: parseNumber(getCell('クレジット')),
    transit: parseNumber(getCell('交通系')),
    quicpay: parseNumber(getCell('QUICPay')),
    id: parseNumber(getCell('iD')),
    qr: parseNumber(getCell('QR')),
    payPay: parseNumber(getCell('PayPay')),
    accountsReceivable: parseNumber(getCell('売掛'))
  };

  // 税区分
  const totalStandard10 = parseNumber(getCell('売上（10%標準）'));
  const returnCount = parseNumber(getCell('返品数'));
  const refundAmount = parseNumber(getCell('返金額'));

  return {
    date,
    total,
    transactionCount,
    avgPerTransaction,
    customerCount,
    avgPerCustomer,
    itemCount,
    paymentMethods,
    totalStandard10,
    returnCount,
    refundAmount
  };
}
