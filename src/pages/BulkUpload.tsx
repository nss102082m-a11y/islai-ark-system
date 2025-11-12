import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle, Loader, FileText, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseSalesSummaryCSV } from '../utils/csv';

interface UploadFile {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  message?: string;
  date?: string;
}

interface UploadStats {
  total: number;
  success: number;
  skipped: number;
  error: number;
  processed: number;
}

export function BulkUpload() {
  const { currentUser: user } = useAuth();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<UploadStats>({
    total: 0,
    success: 0,
    skipped: 0,
    error: 0,
    processed: 0,
  });

  // デバッグログ - 権限チェック
  useEffect(() => {
    console.log('\n========================================');
    console.log('🔍 [BulkUpload] 権限チェック');
    console.log('========================================');
    console.log('📧 ユーザー:', user?.email || 'ログインなし');
    console.log('🆔 UID:', user?.uid || 'なし');
    console.log('👤 ロール:', user?.role || 'なし');
    console.log('📦 permissions オブジェクト:', user?.permissions);
    console.log('🔑 bulkUpload 権限:', user?.permissions?.bulkUpload);
    console.log('✅ アクセス判定:', user?.permissions?.bulkUpload === true ? '許可' : '拒否');
    console.log('========================================\n');
  }, [user]);

  // 権限チェック
  const hasPermission = user?.permissions?.bulkUpload === true;

  if (!hasPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">
              アクセス拒否
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400">
              この機能は一括アップロード権限を持つユーザーのみが利用できます
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.csv')
    );

    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.name.endsWith('.csv')
      );
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);
    setStats((prev) => ({
      ...prev,
      total: prev.total + newFiles.length,
    }));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
    setStats((prev) => ({
      ...prev,
      total: prev.total - 1,
    }));
  };

  // 日付抽出関数（複数フォーマット対応）
  const extractDateFromFilename = (filename: string): string => {
    console.log('[日付抽出] ファイル名:', filename);

    // パターン1: ハイフン区切り形式（YYYY-MM-DD）
    // 例: sales_data_2025-11-01-003902.csv → 2025-11-01
    const hyphenMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (hyphenMatch) {
      const [, year, month, day] = hyphenMatch;
      const dateStr = `${year}-${month}-${day}`;
      console.log('[日付抽出] ✅ ハイフン形式から抽出:', dateStr);
      return dateStr;
    }

    // パターン2: 8桁連続範囲形式（YYYYMMDD-YYYYMMDD）
    // 例: 売上集計_20241001-20241031.csv → 2024-10-31（最後の日付）
    const rangeMatch = filename.match(/(\d{8})-(\d{8})/);
    if (rangeMatch) {
      const endDate = rangeMatch[2]; // 20241031
      const year = endDate.substring(0, 4);
      const month = endDate.substring(4, 6);
      const day = endDate.substring(6, 8);
      const dateStr = `${year}-${month}-${day}`;
      console.log('[日付抽出] ✅ 8桁範囲形式から抽出:', dateStr);
      return dateStr;
    }

    // パターン3: 8桁連続形式（YYYYMMDD）
    // 例: 売上集計_20241001.csv → 2024-10-01
    const digitMatch = filename.match(/(\d{8})/);
    if (digitMatch) {
      const dateStr = digitMatch[1];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const formattedDate = `${year}-${month}-${day}`;
      console.log('[日付抽出] ✅ 8桁形式から抽出:', formattedDate);
      return formattedDate;
    }

    // パターン4: スラッシュ区切り形式（YYYY/MM/DD）
    // 例: sales_2025/11/01.csv → 2025-11-01
    const slashMatch = filename.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (slashMatch) {
      const [, year, month, day] = slashMatch;
      const dateStr = `${year}-${month}-${day}`;
      console.log('[日付抽出] ✅ スラッシュ形式から抽出:', dateStr);
      return dateStr;
    }

    // どのパターンにも一致しない場合
    console.error('[日付抽出] ❌ 失敗: どのパターンにも一致しません');
    console.error('[日付抽出] サポート形式:');
    console.error('  - YYYY-MM-DD (例: sales_data_2025-11-01.csv)');
    console.error('  - YYYYMMDD (例: 売上集計_20251101.csv)');
    console.error('  - YYYYMMDD-YYYYMMDD (例: 売上集計_20251101-20251130.csv)');
    console.error('  - YYYY/MM/DD (例: sales_2025/11/01.csv)');

    throw new Error(
      `ファイル名から日付を抽出できません: ${filename}\n\n` +
      `サポートされている形式:\n` +
      `  • YYYY-MM-DD (例: 2025-11-01)\n` +
      `  • YYYYMMDD (例: 20251101)\n` +
      `  • YYYY/MM/DD (例: 2025/11/01)`
    );
  };

  // 重複チェック関数
  const checkIfReportExists = async (date: string): Promise<boolean> => {
    try {
      const docRef = doc(db, 'daily_reports', date);
      const docSnap = await getDoc(docRef);
      const exists = docSnap.exists();
      console.log(`[重複チェック] ${date}: ${exists ? '既存' : '新規'}`);
      return exists;
    } catch (error) {
      console.error('[重複チェック] エラー:', error);
      return false;
    }
  };

  // ファイル処理関数
  const startProcessing = async () => {
    console.log('[一括処理] 開始:', files.length, 'ファイル');
    setIsProcessing(true);

    const newStats = {
      total: files.length,
      success: 0,
      skipped: 0,
      error: 0,
      processed: 0,
    };

    const updatedFiles = [...files];

    for (let i = 0; i < files.length; i++) {
      const uploadFile = updatedFiles[i];
      console.log(`\n[処理 ${i + 1}/${files.length}] ${uploadFile.file.name}`);

      // 処理中に更新
      updatedFiles[i] = { ...uploadFile, status: 'processing' };
      setFiles([...updatedFiles]);

      try {
        // 1. 日付抽出（エラー時は自動的に throw される）
        const date = extractDateFromFilename(uploadFile.file.name);
        updatedFiles[i].date = date;

        // 2. 重複チェック
        const exists = await checkIfReportExists(date);
        if (exists) {
          console.log('[スキップ] 既に存在:', date);
          updatedFiles[i] = {
            ...uploadFile,
            status: 'skipped',
            message: `既に存在: ${date}`,
            date,
          };
          newStats.skipped++;
          newStats.processed++;
          setFiles([...updatedFiles]);
          setStats({ ...newStats });
          continue;
        }

        // 3. CSV解析
        console.log('[CSV解析] 開始');
        const parseResult = await parseSalesSummaryCSV(uploadFile.file);

        if (!parseResult.success || !parseResult.data || parseResult.data.length === 0) {
          throw new Error(parseResult.errors[0]?.message || 'CSV解析エラー');
        }

        const csvData = parseResult.data[0]; // 1行目のデータ
        console.log('[CSV解析] 成功:', csvData);

        // 4. Firestore保存
        console.log('[Firestore] 保存開始:', date);
        const reportData = {
          date,
          sales: {
            total: csvData.total,
            transactionCount: csvData.transactionCount,
            avgPerTransaction: csvData.avgPerTransaction,
            customerCount: csvData.customerCount,
            avgPerCustomer: csvData.avgPerCustomer,
            itemCount: csvData.itemCount,
            paymentMethods: csvData.paymentMethods,
            totalStandard10: csvData.totalStandard10,
            returnCount: csvData.returnCount,
            refundAmount: csvData.refundAmount,
          },
          locked: false,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || 'bulk_upload',
          source: 'bulk_upload',
        };

        await setDoc(doc(db, 'daily_reports', date), reportData);
        console.log('[Firestore] 保存成功');

        // 成功
        updatedFiles[i] = {
          ...uploadFile,
          status: 'success',
          message: `保存完了: ${date}`,
          date,
        };
        newStats.success++;

      } catch (error) {
        console.error('[エラー]', error);
        updatedFiles[i] = {
          ...uploadFile,
          status: 'error',
          message: (error as Error).message,
        };
        newStats.error++;
      }

      newStats.processed++;
      setFiles([...updatedFiles]);
      setStats({ ...newStats });
    }

    setIsProcessing(false);
    console.log('[一括処理] 完了:', newStats);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const progress = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <div>
              <h1 className="text-2xl font-bold text-black dark:text-white">
                📦 過去データ一括アップロード
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                売上集計CSV（2022年〜2024年9月）を一括取り込み
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>注意:</strong> この機能は過去の売上集計CSVファイルを一括で取り込みます。
              重複データは自動的にスキップされます。
            </p>
          </div>
        </div>

        {/* アップロードエリア */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-black dark:text-white mb-4">
            ファイル選択
          </h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
            }`}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${
              isDragging ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'
            }`} />
            <p className="text-lg font-medium text-black dark:text-white mb-2">
              CSVファイルをドラッグ&ドロップ
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              または
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700 cursor-pointer transition-colors">
              <Upload className="w-5 h-5" />
              ファイルを選択
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              対応形式: .csv のみ（複数選択可能）
            </p>
          </div>

          {/* ファイルリスト */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-black dark:text-white mb-3">
                選択されたファイル ({files.length}件)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((uploadFile, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate">
                        {uploadFile.file.name}
                      </p>
                      {uploadFile.message && (
                        <p className={`text-xs mt-1 ${
                          uploadFile.status === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : uploadFile.status === 'success'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {uploadFile.message}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(uploadFile.file.size / 1024).toFixed(1)} KB
                    </span>
                    {uploadFile.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 処理状態表示 */}
        {isProcessing && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">
              処理状況
            </h2>

            {/* 全体の進捗バー */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                <span>全体の進捗</span>
                <span>{stats.processed} / {stats.total} ファイル</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-teal-500 dark:bg-teal-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* 統計 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">処理中</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.processed}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">成功</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.success}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">スキップ</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {stats.skipped}
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">エラー</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {stats.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 結果サマリー */}
        {!isProcessing && stats.processed > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-bold text-black dark:text-white">
                処理完了
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 mb-1">
                  取り込み成功
                </p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                  {stats.success}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  ファイル
                </p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-1">
                  スキップ（重複）
                </p>
                <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                  {stats.skipped}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  ファイル
                </p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 mb-1">
                  エラー
                </p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                  {stats.error}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  ファイル
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setFiles([]);
                setStats({ total: 0, success: 0, skipped: 0, error: 0, processed: 0 });
              }}
              className="mt-4 w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              新しいアップロードを開始
            </button>
          </div>
        )}

        {/* アクションボタン */}
        {files.length > 0 && !isProcessing && stats.processed === 0 && (
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setFiles([]);
                setStats({ total: 0, success: 0, skipped: 0, error: 0, processed: 0 });
              }}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              クリア
            </button>
            <button
              onClick={startProcessing}
              className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              {files.length}件のファイルを処理
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
