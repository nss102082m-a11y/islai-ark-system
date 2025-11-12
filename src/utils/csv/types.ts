// CSV解析用の型定義
// 既存システムには一切影響しません

/**
 * 会計明細CSV（エアレジ）の1トランザクション
 */
export interface AccountingDetail {
  // 基本情報
  transactionNo: string;       // 伝票番号
  visitDate: string;           // 来店日（YYYY-MM-DD）
  visitTime: string;           // 来店時間（HH:mm）
  accountingDate: string;      // 会計日（YYYY-MM-DD）
  accountingTime: string;      // 会計時間（HH:mm）

  // 金額（CSVの値をそのまま使用）
  total: number;               // 合計（税込）
  subtotal: number;            // 小計
  consumptionTax: number;      // 内消費税

  // 支払方法
  cash: number;                // 現金
  creditCard: number;          // クレジット
  transit: number;             // 交通系
  quicpay: number;             // QUICPay
  id: number;                  // iD
  qr: number;                  // QR
  payPay: number;              // PayPay
  accountsReceivable: number;  // 売掛
  change: number;              // おつり

  // 顧客情報
  customerCount: number;       // 客数
  itemCount: number;           // 商品数

  // 商品詳細
  items: Array<{
    id: string;                // 商品ID（不変）
    category: string;          // カテゴリー名
    menu: string;              // メニュー名
    price: number;             // 単価
    quantity: number;          // 数量
  }>;
}

/**
 * 売上集計CSV（エアレジ）の1日分
 */
export interface SalesSummary {
  date: string;                // 集計期間（YYYY-MM-DD）

  // 売上
  total: number;               // 売上（税込）
  transactionCount: number;    // 会計数
  avgPerTransaction: number;   // 会計単価
  customerCount: number;       // 客数
  avgPerCustomer: number;      // 客単価
  itemCount: number;           // 商品数

  // 支払方法別
  paymentMethods: {
    cash: number;
    creditCard: number;
    transit: number;
    quicpay: number;
    id: number;
    qr: number;
    payPay: number;
    accountsReceivable: number;
  };

  // 税区分
  totalStandard10: number;     // 売上（10%標準）
  returnCount: number;         // 返品数
  refundAmount: number;        // 返金額
}

/**
 * 顧客属性分析結果
 */
export interface CustomerDemographics {
  japanese: { adult: number; child: number; infant: number };
  western: { adult: number; child: number; infant: number };
  chinese: { adult: number; child: number; infant: number };
  korean: { adult: number; child: number; infant: number };
  hongkong: { adult: number; child: number; infant: number };
}

/**
 * CSV解析エラー
 */
export interface CSVParseError {
  row: number;
  column: string;
  value: string;
  message: string;
}

/**
 * CSV解析結果
 */
export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  errors: CSVParseError[];
  warnings: string[];
}
