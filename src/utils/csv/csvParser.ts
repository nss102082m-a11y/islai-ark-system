import { CSVParseError } from './types';

/**
 * Shift-JISエンコーディングをUTF-8に変換
 */
export async function convertShiftJISToUTF8(file: File): Promise<string> {
  console.log('[CSV] ファイル変換開始:', file.name);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Shift-JIS判定（簡易版）
    const hasShiftJIS = Array.from(uint8Array.slice(0, 100)).some(
      byte => byte > 0x7F && byte < 0xA0
    );

    if (hasShiftJIS) {
      console.log('[CSV] Shift-JIS検出、変換します');
      // TextDecoderでShift-JISをデコード
      const decoder = new TextDecoder('shift-jis');
      const text = decoder.decode(uint8Array);
      console.log('[CSV] 変換完了、文字数:', text.length);
      return text;
    } else {
      console.log('[CSV] UTF-8として読み込みます');
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(uint8Array);
    }
  } catch (error) {
    console.error('[CSV] 変換エラー:', error);
    throw new Error(`CSV変換に失敗しました: ${error}`);
  }
}

/**
 * CSV文字列を2次元配列にパース
 */
export function parseCSVToArray(csvText: string): string[][] {
  console.log('[CSV] パース開始');

  const lines = csvText.split('\n');
  const result: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // カンマ区切りでパース（ダブルクォート対応）
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    cells.push(currentCell.trim());
    result.push(cells);
  }

  console.log('[CSV] パース完了、行数:', result.length);
  return result;
}

/**
 * ヘッダー行を検証
 */
export function validateHeaders(
  actualHeaders: string[],
  requiredHeaders: string[]
): CSVParseError[] {
  console.log('========================================');
  console.log('[CSV] 📋 ヘッダー検証開始');
  console.log('[CSV] 実際のヘッダー数:', actualHeaders.length);
  console.log('[CSV] 期待するヘッダー数:', requiredHeaders.length);
  console.log('========================================');
  console.log('[CSV] 実際のヘッダー（全' + actualHeaders.length + '個）:');
  actualHeaders.forEach((h, i) => {
    console.log(`  [${i}] "${h}"`);
  });
  console.log('========================================');
  console.log('[CSV] 期待するヘッダー（全' + requiredHeaders.length + '個）:');
  requiredHeaders.forEach((h, i) => {
    console.log(`  [${i}] "${h}"`);
  });
  console.log('========================================');

  const errors: CSVParseError[] = [];
  const missingHeaders = requiredHeaders.filter(
    header => !actualHeaders.includes(header)
  );

  if (missingHeaders.length > 0) {
    console.log('[CSV] ❌ 不足しているヘッダー:', missingHeaders);
    errors.push({
      row: 0,
      field: 'headers',
      message: `必須ヘッダーが不足: ${missingHeaders.join(', ')}`
    });
  } else {
    console.log('[CSV] ✅ すべての必須ヘッダーが存在します');
  }

  console.log('========================================');
  return errors;
}

/**
 * 数値をパース（エラーハンドリング付き）
 */
export function parseNumber(
  value: string,
  defaultValue: number = 0
): number {
  if (!value || value === '') return defaultValue;

  // カンマを除去
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) {
    console.warn('[CSV] 数値パースエラー:', value);
    return defaultValue;
  }

  return num;
}

/**
 * 日付をYYYY-MM-DD形式に変換
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';

  // 様々な形式に対応
  // 例: "2024/10/31", "2024-10-31", "20241031"
  const cleaned = dateString.replace(/[\/\-]/g, '');

  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }

  return dateString;
}
