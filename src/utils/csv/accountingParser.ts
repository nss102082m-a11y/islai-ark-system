import { AccountingDetail, ParseResult, CSVParseError } from './types';
import {
  convertShiftJISToUTF8,
  parseCSVToArray,
  validateHeaders,
  parseNumber,
  formatDate
} from './csvParser';

/**
 * 会計明細CSVの全ヘッダー定義
 */
const ACCOUNTING_DETAIL_HEADERS = [
  '取引No',
  '来店日',
  '来店時間',
  '会計日',
  '会計時間',
  '合計',
  '合計（10%標準）',
  '合計（8%軽減）',
  '合計（8%標準）',
  '合計（非課税）',
  '小計',
  '内消費税',
  '内消費税（10%標準）',
  '修正金額合計',
  '修正後合計',
  '修正後内消費税',
  '現金',
  'クレジットカード(Airペイ)',
  '交通系電子マネー(Airペイ)',
  'QUICPay(Airペイ)',
  'iD(Airペイ)',
  'QR決済(Airペイ QR)',
  'クレジットカード/電子マネー(Square)',
  'ポイント(Airペイ ポイント)',
  'ポイント(ホットペッパーグルメ)',
  'Pontaポイント(Airウォレット)',
  '金券内訳',
  'PayPay',
  '売掛金',
  '金券合計',
  '売掛合計',
  'おつり',
  '現金以外おつり不支払額',
  '全体割引/割増(税込)',
  '個別割引/割増(税込)',
  'まとめ買い割引(税込)',
  '割引/割増合計(税込)',
  '人数',
  '商品点数',
  '滞在時間',
  '伝票名',
  'レジID',
  'レジ担当者名',
  'リソース名',
  'メモ',
  'ID',
  'カテゴリー名',
  'メニュー名',
  '種別１',
  '種別２',
  '価格',
  '注文数量',
  '個別割引/割増数量',
  '個別割引/割増単価',
  '単位',
  '個別割引/割増合計額',
  'まとめ買い割引名',
  'まとめ買い割引セット価格',
  'まとめ買い割引セット数',
  'まとめ買い割引数',
  'まとめ買い割引合計額'
];

/**
 * 会計明細CSVの必須ヘッダー（最小限のチェック用）
 */
const REQUIRED_HEADERS = ['取引No', '来店日', '合計', 'カテゴリー名', 'メニュー名'];

/**
 * 会計明細CSVをパース
 */
export async function parseAccountingDetailCSV(
  file: File
): Promise<ParseResult<AccountingDetail[]>> {
  console.log('[会計明細] パース開始:', file.name);

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
    const data: AccountingDetail[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      try {
        const detail = parseAccountingDetailRow(headers, row, i);
        data.push(detail);
      } catch (error) {
        errors.push({
          row: i + 1,
          column: '',
          value: '',
          message: `行のパースエラー: ${error}`
        });
      }
    }

    console.log('[会計明細] パース完了:', data.length, '件');

    return {
      success: errors.length === 0,
      data,
      errors,
      warnings
    };

  } catch (error) {
    console.error('[会計明細] パース失敗:', error);
    return {
      success: false,
      data: null,
      errors: [{ row: 0, column: '', value: '', message: `${error}` }],
      warnings: []
    };
  }
}

/**
 * 1行をAccountingDetailオブジェクトに変換
 */
function parseAccountingDetailRow(
  headers: string[],
  row: string[],
  rowIndex: number
): AccountingDetail {
  const getCell = (header: string): string => {
    const index = headers.indexOf(header);
    return index >= 0 ? row[index] : '';
  };

  // 基本情報
  const transactionNo = getCell('伝票番号');
  const visitDate = formatDate(getCell('来店日'));
  const visitTime = getCell('来店時間');
  const accountingDate = formatDate(getCell('会計日'));
  const accountingTime = getCell('会計時間');

  // 金額
  const total = parseNumber(getCell('合計'));
  const subtotal = parseNumber(getCell('小計'));
  const consumptionTax = parseNumber(getCell('内消費税'));

  // 支払方法
  const cash = parseNumber(getCell('現金'));
  const creditCard = parseNumber(getCell('クレジット'));
  const transit = parseNumber(getCell('交通系'));
  const quicpay = parseNumber(getCell('QUICPay'));
  const id = parseNumber(getCell('iD'));
  const qr = parseNumber(getCell('QR'));
  const payPay = parseNumber(getCell('PayPay'));
  const accountsReceivable = parseNumber(getCell('売掛'));
  const change = parseNumber(getCell('おつり'));

  // 顧客情報
  const customerCount = parseNumber(getCell('客数'));
  const itemCount = parseNumber(getCell('商品数'));

  // 商品詳細
  const items = parseProductItems(headers, row);

  return {
    transactionNo,
    visitDate,
    visitTime,
    accountingDate,
    accountingTime,
    total,
    subtotal,
    consumptionTax,
    cash,
    creditCard,
    transit,
    quicpay,
    id,
    qr,
    payPay,
    accountsReceivable,
    change,
    customerCount,
    itemCount,
    items
  };
}

/**
 * 商品詳細をパース
 */
function parseProductItems(headers: string[], row: string[]): Array<{
  id: string;
  category: string;
  menu: string;
  price: number;
  quantity: number;
}> {
  const items: Array<{
    id: string;
    category: string;
    menu: string;
    price: number;
    quantity: number;
  }> = [];

  // 商品IDカラムを探す（商品ID1, 商品ID2, ...）
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];

    if (header.startsWith('商品ID')) {
      const id = row[i];
      if (!id) continue;

      // 商品番号を抽出（例: "商品ID1" → "1"）
      const productNum = header.replace('商品ID', '');

      // 対応するカラムを探す
      const category = getCell(headers, row, `カテゴリー名${productNum}`);
      const menu = getCell(headers, row, `メニュー名${productNum}`);
      const price = parseNumber(getCell(headers, row, `単価${productNum}`));
      const quantity = parseNumber(getCell(headers, row, `数量${productNum}`));

      items.push({
        id,
        category,
        menu,
        price,
        quantity
      });
    }
  }

  console.log(`[会計明細] 商品数: ${items.length}`);
  return items;
}

/**
 * ヘッダー名からセル値を取得
 */
function getCell(headers: string[], row: string[], header: string): string {
  const index = headers.indexOf(header);
  return index >= 0 ? row[index] : '';
}
