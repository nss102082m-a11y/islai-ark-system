import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { INITIAL_ATTENDANTS, DEFAULT_PERMISSIONS } from '../constants';
import { User as UserIcon, Palette, Ship, DollarSign, Plus, Trash2, Save, Clock, Mail, Briefcase, Lock, Edit, Package } from 'lucide-react';
import { InitialTimes, User, UserPermissions, SalesChannel } from '../types';
import { EditChannelModal } from '../components/EditChannelModal';
import { addMinutes, parse, format } from 'date-fns';
import { ToggleSwitch } from '../components/ToggleSwitch';

export function Settings() {
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const canManageAccounts = currentUser?.permissions?.accountManagement || currentUser?.role === 'owner_executive' || currentUser?.role === 'admin';
  const canEditBusinessSettings = currentUser?.role === 'owner_executive' || currentUser?.role === 'admin';

  const getInitialTab = (): 'basic' | 'knowledge' | 'accounts' | 'system' | 'management' | 'access_logs' => {
    if (canEditBusinessSettings) return 'basic';
    if (canManageAccounts) return 'accounts';
    return 'system';
  };

  const [activeTab, setActiveTab] = useState<'basic' | 'knowledge' | 'accounts' | 'system' | 'management' | 'access_logs'>(getInitialTab());

  const canAccessManagement = currentUser?.role === 'owner_executive' ||
                              currentUser?.role === 'admin';
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryValue, setCategoryValue] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'view' | 'open' | 'download'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const loadCategories = async () => {
    try {
      const q = query(collection(db, 'knowledge_categories'), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const categoriesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesList);
    } catch (error) {
      console.error('カテゴリー読み込みエラー:', error);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName || !categoryValue) {
      alert('カテゴリー名とカテゴリー値を入力してください');
      return;
    }

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'knowledge_categories', editingCategory.id), {
          name: categoryName,
          value: categoryValue,
          icon: categoryIcon || '📁'
        });
        alert('カテゴリーを更新しました');
      } else {
        await addDoc(collection(db, 'knowledge_categories'), {
          name: categoryName,
          value: categoryValue,
          icon: categoryIcon || '📁',
          order: categories.length,
          createdAt: new Date(),
          createdBy: auth.currentUser?.uid
        });
        alert('カテゴリーを追加しました');
      }

      setCategoryDialogOpen(false);
      loadCategories();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('このカテゴリーを削除しますか？')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'knowledge_categories', categoryId));
      alert('カテゴリーを削除しました');
      loadCategories();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const handleExportCSV = (filteredLogs: any[]) => {
    try {
      const headers = ['日時', 'ユーザー', 'メールアドレス', '文書名', 'カテゴリ', 'アクセスタイプ', '機密レベル'];

      const rows = filteredLogs.map(log => {
        const date = new Date(log.accessedAt.seconds * 1000);
        const dateStr = date.toLocaleString('ja-JP');

        const accessTypeLabel =
          log.accessType === 'view' ? '閲覧' :
          log.accessType === 'open' ? '開く' :
          log.accessType === 'download' ? 'DL試行' :
          log.accessType || '不明';

        const securityLevelLabel =
          log.securityLevel === 0 ? '公開' :
          log.securityLevel === 1 ? '社内限定' :
          log.securityLevel === 2 ? '機密' :
          log.securityLevel === 3 ? '極秘' : '不明';

        return [
          dateStr,
          log.userName || '不明',
          log.userEmail || '',
          log.documentTitle || '',
          log.documentCategory || '',
          accessTypeLabel,
          securityLevelLabel
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `アクセスログ_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('CSVエクスポート完了');
    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      alert('CSVのエクスポートに失敗しました');
    }
  };

  const loadAccessLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'access_logs'),
        orderBy('accessedAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccessLogs(logs);
    } catch (error) {
      console.error('アクセスログ読み込みエラー:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'access_logs') {
      loadAccessLogs();
    }
  }, [activeTab]);

  const tabCount = (canEditBusinessSettings ? 2 : 0) + (canManageAccounts ? 1 : 0) + 1;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">⚙️ 設定</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav
              className="grid px-6"
              style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}
              aria-label="Tabs"
            >
              {canEditBusinessSettings && (
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'basic'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  📋 基本設定
                </button>
              )}

              {canEditBusinessSettings && (
                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'knowledge'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  📚 ナレッジベース設定
                </button>
              )}

              {canManageAccounts && (
                <button
                  onClick={() => setActiveTab('accounts')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'accounts'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  👥 アカウント管理
                </button>
              )}

              <button
                onClick={() => setActiveTab('system')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'system'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                ⚙️ システム設定
              </button>

              {canAccessManagement && (
                <button
                  onClick={() => setActiveTab('management')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'management'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  🔧 システム管理
                </button>
              )}

              {(currentUser?.role === 'owner_executive' || currentUser?.role === 'admin') && (
                <button
                  onClick={() => setActiveTab('access_logs')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'access_logs'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  📊 アクセスログ
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'basic' && canEditBusinessSettings && <BasicSettings />}
            {activeTab === 'knowledge' && canEditBusinessSettings && (
              <KnowledgeBaseSettings
                categories={categories}
                setCategories={setCategories}
                categoryDialogOpen={categoryDialogOpen}
                setCategoryDialogOpen={setCategoryDialogOpen}
                editingCategory={editingCategory}
                setEditingCategory={setEditingCategory}
                categoryName={categoryName}
                setCategoryName={setCategoryName}
                categoryValue={categoryValue}
                setCategoryValue={setCategoryValue}
                categoryIcon={categoryIcon}
                setCategoryIcon={setCategoryIcon}
                handleDeleteCategory={handleDeleteCategory}
              />
            )}
            {activeTab === 'accounts' && canManageAccounts && <AccountManagement />}
            {activeTab === 'system' && <SystemSettings theme={theme} setTheme={setTheme} currentUser={currentUser} />}
            {activeTab === 'management' && canAccessManagement && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">💰 月次・年次費用</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ISLAIシステムの維持管理に必要な費用
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-700 dark:text-gray-300 font-semibold">必須費用</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Bolt.new</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">要確認（商用プラン）</span>
                          <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Firebase</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600 dark:text-green-400">無料枠内</span>
                          <span className="text-green-600 dark:text-green-400">✅</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">ドメイン</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600 dark:text-green-400">無料（bolt.host）</span>
                          <span className="text-green-600 dark:text-green-400">✅</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-600 dark:text-gray-400 font-semibold">オプション費用（将来）</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">独自ドメイン</span>
                        <span className="font-medium text-gray-600 dark:text-gray-400">約1,200円/年</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Claude API</span>
                        <span className="font-medium text-gray-600 dark:text-gray-400">従量課金</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">外部ストレージ</span>
                        <span className="font-medium text-gray-600 dark:text-gray-400">約500円〜/月</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 text-lg">💡</span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        詳細な費用情報や管理方法は、システム管理ドキュメントを参照してください。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 🔗 管理リンク集セクション */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                    🔗 管理リンク集
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Firebase Console */}
                    <a
                      href="https://console.firebase.google.com/project/islai-ark-d6035"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg hover:shadow-md transition border border-orange-200 dark:border-orange-800"
                    >
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">🔥</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">Firebase Console</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">データベース、認証、ストレージの管理</p>
                    </a>

                    {/* Google Apps Script */}
                    <a
                      href="https://script.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg hover:shadow-md transition border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">📜</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">Google Apps Script</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">API Proxyの管理とログ確認</p>
                    </a>

                    {/* 気象庁API */}
                    <a
                      href="https://www.jma.go.jp/bosai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 rounded-lg hover:shadow-md transition border border-sky-200 dark:border-sky-800"
                    >
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">🌤️</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">気象庁API</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">気象データの確認</p>
                    </a>

                    {/* Bolt.new */}
                    <a
                      href="https://bolt.new/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg hover:shadow-md transition border border-purple-200 dark:border-purple-800"
                    >
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">🚀</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">Bolt.new</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">開発・デプロイの管理</p>
                    </a>
                  </div>
                </div>

                {/* 📖 クイックリファレンスセクション */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                    📖 管理者クイックリファレンス
                  </h3>

                  <div className="space-y-4">
                    {/* 新規ユーザー追加 */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-teal-500">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <span className="mr-2">👤</span>
                        新規ユーザー追加
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        設定 → アカウント管理 → 「新規ユーザー追加」ボタン → 情報入力 → 権限設定
                      </p>
                    </div>

                    {/* 販売チャネル追加 */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-blue-500">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <span className="mr-2">💰</span>
                        販売チャネル追加
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        設定 → 基本設定 → 販売チャネル管理 → 「新規追加」→ 価格設定
                      </p>
                    </div>

                    {/* データバックアップ */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-purple-500">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <span className="mr-2">💾</span>
                        データバックアップ
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Firebase Console → Firestore Database → 「エクスポート」→ ローカルに保存
                      </p>
                    </div>

                    {/* トラブル時の対応 */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-red-500">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <span className="mr-2">🚨</span>
                        システムトラブル時
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        1. ブラウザのコンソール（F12）でエラー確認
                        <br />
                        2. Firebase Console で接続確認
                        <br />
                        3. 気象庁API の動作確認
                      </p>
                    </div>
                  </div>

                  {/* 詳細ドキュメントへのリンク */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      📚 詳細な管理マニュアル、メンテナンススケジュール、トラブルシューティングは
                    </p>
                    <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                      SYSTEM_MAINTENANCE_MASTER.md を参照してください
                    </p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'access_logs' && (currentUser?.role === 'owner_executive' || currentUser?.role === 'admin') && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">アクセスログ</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      最近100件のアクセス履歴を表示しています
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-4 items-center justify-end">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDateFilter('all')}
                          className={`px-3 py-1 rounded text-sm ${
                            dateFilter === 'all'
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          すべて
                        </button>
                        <button
                          onClick={() => setDateFilter('today')}
                          className={`px-3 py-1 rounded text-sm ${
                            dateFilter === 'today'
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          今日
                        </button>
                        <button
                          onClick={() => setDateFilter('week')}
                          className={`px-3 py-1 rounded text-sm ${
                            dateFilter === 'week'
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          今週
                        </button>
                        <button
                          onClick={() => setDateFilter('month')}
                          className={`px-3 py-1 rounded text-sm ${
                            dateFilter === 'month'
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          今月
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={loadAccessLogs}
                          disabled={loadingLogs}
                          className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingLogs ? '読み込み中...' : '更新'}
                        </button>
                        <button
                          onClick={() => {
                            const filteredLogs = accessLogs.filter(log => {
                              if (dateFilter !== 'all') {
                                const logDate = new Date(log.accessedAt.seconds * 1000);
                                const now = new Date();
                                if (dateFilter === 'today') {
                                  if (logDate.toDateString() !== now.toDateString()) return false;
                                }
                                if (dateFilter === 'week') {
                                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                  if (logDate < weekAgo) return false;
                                }
                                if (dateFilter === 'month') {
                                  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                  if (logDate < monthAgo) return false;
                                }
                              }
                              if (typeFilter !== 'all') {
                                if (log.accessType !== typeFilter) return false;
                              }
                              if (userFilter !== 'all') {
                                const userName = log.userName || '不明';
                                if (userName !== userFilter) return false;
                              }
                              return true;
                            });
                            handleExportCSV(filteredLogs);
                          }}
                          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                        >
                          CSVエクスポート
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setTypeFilter('all')}
                        className={`px-3 py-1 rounded text-sm ${
                          typeFilter === 'all'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        すべて
                      </button>
                      <button
                        onClick={() => setTypeFilter('view')}
                        className={`px-3 py-1 rounded text-sm ${
                          typeFilter === 'view'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        👁️ 閲覧
                      </button>
                      <button
                        onClick={() => setTypeFilter('open')}
                        className={`px-3 py-1 rounded text-sm ${
                          typeFilter === 'open'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        🔓 開く
                      </button>
                      <button
                        onClick={() => setTypeFilter('download')}
                        className={`px-3 py-1 rounded text-sm ${
                          typeFilter === 'download'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        📥 DL試行
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">ユーザー:</label>
                      <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                      >
                        <option value="all">すべてのユーザー</option>
                        {(() => {
                          const uniqueUsers = Array.from(
                            new Set(accessLogs.map(log => log.userName || '不明'))
                          ).sort();
                          return uniqueUsers.map(userName => (
                            <option key={userName} value={userName}>
                              {userName}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 統計情報 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* 今日のアクセス */}
                  <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-4 text-white">
                    <div className="text-sm opacity-90">今日のアクセス</div>
                    <div className="text-3xl font-bold mt-1">
                      {accessLogs.filter(log => {
                        const logDate = new Date(log.accessedAt.seconds * 1000);
                        return logDate.toDateString() === new Date().toDateString();
                      }).length}
                    </div>
                  </div>

                  {/* 今週のアクセス */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <div className="text-sm opacity-90">今週のアクセス</div>
                    <div className="text-3xl font-bold mt-1">
                      {accessLogs.filter(log => {
                        const logDate = new Date(log.accessedAt.seconds * 1000);
                        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                        return logDate >= weekAgo;
                      }).length}
                    </div>
                  </div>

                  {/* 今月のアクセス */}
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                    <div className="text-sm opacity-90">今月のアクセス</div>
                    <div className="text-3xl font-bold mt-1">
                      {accessLogs.filter(log => {
                        const logDate = new Date(log.accessedAt.seconds * 1000);
                        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        return logDate >= monthAgo;
                      }).length}
                    </div>
                  </div>
                </div>

                {/* TOP5統計 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* 人気文書TOP5 */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      📊 人気文書TOP5
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        const docCounts = accessLogs.reduce((acc, log) => {
                          acc[log.documentTitle] = (acc[log.documentTitle] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        return Object.entries(docCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5)
                          .map(([title, count], index) => (
                            <div key={title} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-bold text-gray-400 dark:text-gray-600">
                                  {index + 1}
                                </span>
                                <span className="truncate">{title}</span>
                              </div>
                              <span className="font-semibold text-teal-600 dark:text-teal-400 ml-2">
                                {count}回
                              </span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>

                  {/* アクティブユーザーTOP5 */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      👥 アクティブユーザーTOP5
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        const userCounts = accessLogs.reduce((acc, log) => {
                          const userName = log.userName || '不明';
                          acc[userName] = (acc[userName] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        return Object.entries(userCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5)
                          .map(([name, count], index) => (
                            <div key={name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-400 dark:text-gray-600">
                                  {index + 1}
                                </span>
                                <span>{name}</span>
                              </div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {count}回
                              </span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>

                {(() => {
                  const filteredLogs = accessLogs.filter(log => {
                    // 期間フィルター
                    if (dateFilter !== 'all') {
                      const logDate = new Date(log.accessedAt.seconds * 1000);
                      const now = new Date();

                      if (dateFilter === 'today') {
                        if (logDate.toDateString() !== now.toDateString()) return false;
                      }

                      if (dateFilter === 'week') {
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (logDate < weekAgo) return false;
                      }

                      if (dateFilter === 'month') {
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (logDate < monthAgo) return false;
                      }
                    }

                    // アクセスタイプフィルター
                    if (typeFilter !== 'all') {
                      if (log.accessType !== typeFilter) return false;
                    }

                    // ユーザーフィルター
                    if (userFilter !== 'all') {
                      const userName = log.userName || '不明';
                      if (userName !== userFilter) return false;
                    }

                    return true;
                  });

                  return loadingLogs ? (
                    <div className="text-center py-8 text-gray-500">読み込み中...</div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      条件に合うログがありません
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b dark:border-gray-700">
                            <th className="text-left p-3">日時</th>
                            <th className="text-left p-3">ユーザー</th>
                            <th className="text-left p-3">文書名</th>
                            <th className="text-left p-3">カテゴリ</th>
                            <th className="text-left p-3">アクセスタイプ</th>
                            <th className="text-left p-3">機密レベル</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map((log) => (
                          <tr key={log.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="p-3 text-sm">
                              {new Date(log.accessedAt.seconds * 1000).toLocaleString('ja-JP')}
                            </td>
                            <td className="p-3 text-sm">{log.userName}</td>
                            <td className="p-3 text-sm">{log.documentTitle}</td>
                            <td className="p-3 text-sm">{log.documentCategory}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                log.accessType === 'view' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                log.accessType === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                log.accessType === 'download' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                              }`}>
                                {log.accessType === 'view' ? '👁️ 閲覧' :
                                 log.accessType === 'open' ? '🔓 開く' :
                                 log.accessType === 'download' ? '⬇️ DL試行' :
                                 log.accessType || '❓ 不明'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                log.securityLevel === 0 ? 'bg-green-100 text-green-800' :
                                log.securityLevel === 1 ? 'bg-blue-100 text-blue-800' :
                                log.securityLevel === 2 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {log.securityLevel === 0 ? '公開' :
                                 log.securityLevel === 1 ? '社内限定' :
                                 log.securityLevel === 2 ? '機密' : '極秘'}
                              </span>
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* カテゴリー追加/編集ダイアログ */}
      {categoryDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCategory ? 'カテゴリーを編集' : 'カテゴリーを追加'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                ナレッジベースのカテゴリー情報を入力してください
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* カテゴリー名 */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  カテゴリー名
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="例: 運航マニュアル"
                />
              </div>

              {/* カテゴリー値（英数字） */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  カテゴリー値（英数字）
                </label>
                <input
                  type="text"
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="例: manual"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  システム内部で使用される識別子（英数字のみ）
                </p>
              </div>

              {/* アイコン（絵文字） */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  アイコン（絵文字）
                </label>
                <input
                  type="text"
                  value={categoryIcon}
                  onChange={(e) => setCategoryIcon(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="例: 📚"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setCategoryDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                {editingCategory ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function BasicSettings() {
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [initialTimes, setInitialTimes] = useState<InitialTimes>({
    kaji: '09:00',
    mui: '09:15',
    tida: '09:00'
  });
  const [dailyWages, setDailyWages] = useState({
    captain: 15000,
    beachStaff: 12000,
    reception: 10000
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSalesChannels(data.salesChannels || []);
        setInitialTimes(data.initialTimes || { kaji: '09:00', mui: '09:15', tida: '09:00' });
        setDailyWages(data.dailyWages || { captain: 15000, beachStaff: 12000, reception: 10000 });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSalesChannels = async () => {
    try {
      setSaving(true);
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(docRef, {
        ...existingData,
        salesChannels: salesChannels
      });

      alert('✅ 販売リストを保存しました');
    } catch (error) {
      console.error('Error saving sales channels:', error);
      alert('❌ 保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const saveInitialTimes = async () => {
    try {
      setSaving(true);
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(docRef, {
        ...existingData,
        initialTimes: initialTimes
      });

      alert('✅ 初期運航時刻を保存しました');
    } catch (error) {
      console.error('Error saving initial times:', error);
      alert('❌ 保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const addChannel = () => {
    setEditingChannel({
      id: `sc${Date.now()}`,
      name: '',
      category: '',
      pricing: { adult: 0, child: 0, infant: 0 },
      periods: []
    });
    setShowEditModal(true);
  };

  const editChannel = (channel: SalesChannel) => {
    setEditingChannel({ ...channel });
    setShowEditModal(true);
  };

  const deleteChannel = (id: string) => {
    if (!confirm('この販売リストを削除しますか？\n乗船管理で使用中の場合、データに影響が出る可能性があります。')) {
      return;
    }
    setSalesChannels(salesChannels.filter(sc => sc.id !== id));
  };

  const saveEditingChannel = () => {
    if (!editingChannel || !editingChannel.name.trim()) {
      alert('リスト名を入力してください');
      return;
    }

    const existing = salesChannels.find(sc => sc.id === editingChannel.id);
    if (existing) {
      setSalesChannels(salesChannels.map(sc =>
        sc.id === editingChannel.id ? editingChannel : sc
      ));
    } else {
      setSalesChannels([...salesChannels, editingChannel]);
    }

    setShowEditModal(false);
    setEditingChannel(null);
  };

  const updateInitialTime = (boat: keyof InitialTimes, time: string) => {
    setInitialTimes({ ...initialTimes, [boat]: time });
  };

  const generateTimeOptions = (start: string, end: string) => {
    const options = [];
    let current = parse(start, 'HH:mm', new Date());
    const endTime = parse(end, 'HH:mm', new Date());

    while (current <= endTime) {
      const timeStr = format(current, 'HH:mm');
      options.push(
        <option key={timeStr} value={timeStr}>{timeStr}</option>
      );
      current = addMinutes(current, 5);
    }

    return options;
  };

  const saveDailyWages = async () => {
    try {
      await updateDoc(doc(db, 'settings', 'general'), {
        dailyWages
      });
      alert('✅ 人件費設定を保存しました');
    } catch (error) {
      console.error('人件費設定保存エラー:', error);
      alert('❌ 保存に失敗しました');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-teal-600 dark:text-teal-400">
          📋 販売リスト管理
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">販売リスト</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                乗船管理で選択できる販売チャネルを管理します
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveSalesChannels}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg disabled:opacity-50 font-bold"
                style={{ minHeight: '44px' }}
              >
                <Save className="w-5 h-5" />
                <span>保存</span>
              </button>
              <button
                onClick={addChannel}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold"
                style={{ minHeight: '44px' }}
              >
                <Plus className="w-5 h-5" />
                <span>追加</span>
              </button>
            </div>
          </div>

          {salesChannels.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              販売リストがありません。「追加」ボタンから作成してください。
            </div>
          ) : (
            <div className="space-y-3">
              {salesChannels.map(channel => (
                <div
                  key={channel.id}
                  className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-bold text-lg text-gray-900 dark:text-white">{channel.name}</div>
                    {channel.category && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        カテゴリ: {channel.category}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      大人 ¥{channel.pricing.adult.toLocaleString()} /
                      子供 ¥{channel.pricing.child.toLocaleString()} /
                      幼児 ¥{channel.pricing.infant.toLocaleString()}
                    </div>
                    {channel.periods.length > 0 && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        📅 期間別料金 {channel.periods.length}件
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editChannel(channel)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      style={{ minHeight: '36px' }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteChannel(channel.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      style={{ minHeight: '36px' }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-teal-600 dark:text-teal-400">
          ⛵ 運航設定
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Clock className="w-6 h-6 mr-2 text-teal-500" />
                初期運航時刻
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                各船の1便目の開始時刻を設定します
              </p>
            </div>
            <button
              onClick={saveInitialTimes}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg disabled:opacity-50"
              style={{ minHeight: '44px' }}
            >
              <Save className="w-5 h-5" />
              <span>保存</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="w-32 font-semibold text-gray-900 dark:text-white">
                カジ
              </label>
              <select
                value={initialTimes.kaji}
                onChange={(e) => updateInitialTime('kaji', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              >
                {generateTimeOptions('08:00', '12:00')}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 font-semibold text-gray-900 dark:text-white">
                ムイ
              </label>
              <select
                value={initialTimes.mui}
                onChange={(e) => updateInitialTime('mui', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              >
                {generateTimeOptions('08:00', '12:00')}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-32 font-semibold text-gray-900 dark:text-white">
                ティダ
              </label>
              <select
                value={initialTimes.tida}
                onChange={(e) => updateInitialTime('tida', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              >
                {generateTimeOptions('08:00', '12:00')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-teal-600 dark:text-teal-400">
          📅 シフト表示設定
        </h2>

        <ShiftDisplaySettings />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-teal-600 dark:text-teal-400">
          💰 人件費設定
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💰 人件費設定</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">各役職の日給を設定します。シフト管理画面での人件費計算に使用されます。</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                船長の日給
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dailyWages.captain}
                  onChange={(e) => setDailyWages({ ...dailyWages, captain: parseInt(e.target.value) || 0 })}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-gray-700 dark:text-gray-300">円/日</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                浜スタッフの日給
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dailyWages.beachStaff}
                  onChange={(e) => setDailyWages({ ...dailyWages, beachStaff: parseInt(e.target.value) || 0 })}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-gray-700 dark:text-gray-300">円/日</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                受付の日給
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dailyWages.reception}
                  onChange={(e) => setDailyWages({ ...dailyWages, reception: parseInt(e.target.value) || 0 })}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-gray-700 dark:text-gray-300">円/日</span>
              </div>
            </div>
          </div>

          <button
            onClick={saveDailyWages}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            人件費設定を保存
          </button>
        </div>
      </div>

      {showEditModal && editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          onChange={setEditingChannel}
          onSave={saveEditingChannel}
          onCancel={() => {
            setShowEditModal(false);
            setEditingChannel(null);
          }}
        />
      )}
    </div>
  );
}

function AccountManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'reception' as const
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const userList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setPermissions(user.permissions || DEFAULT_PERMISSIONS);
  };

  const updatePermission = <K extends keyof UserPermissions>(key: K, value: UserPermissions[K]) => {
    if (permissions) {
      setPermissions({ ...permissions, [key]: value });
    }
  };

  const handleAccountManagementToggle = (checked: boolean) => {
    if (!selectedUser) return;

    if (checked) {
      updatePermission('accountManagement', true);
      return;
    }

    if (selectedUser.role === 'owner_executive') {
      const confirmed = window.confirm(
        '⚠️ アカウント管理権限をOFFにしますか？\n\n' +
        'OFFにすると以下ができなくなります：\n' +
        '・ユーザーの追加・削除\n' +
        '・権限の変更\n' +
        '・このアカウント管理画面へのアクセス\n\n' +
        '本当にOFFにしますか？'
      );

      if (confirmed) {
        updatePermission('accountManagement', false);
      }
    } else {
      updatePermission('accountManagement', false);
    }
  };

  const updateShiftDisplaySetting = async (key: string, value: boolean) => {
    if (!selectedUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        [`shiftDisplaySettings.${key}`]: value
      });

      const updatedUser = {
        ...selectedUser,
        shiftDisplaySettings: {
          ...selectedUser.shiftDisplaySettings,
          [key]: value
        }
      };

      setSelectedUser(updatedUser);
      setUsers(prevUsers =>
        prevUsers.map(u => u.uid === selectedUser.uid ? updatedUser : u)
      );

      console.log('✅ シフト表示権限を更新しました:', key, value);
    } catch (error) {
      console.error('Error updating shift display settings:', error);
      alert('❌ 更新に失敗しました');
    }
  };

  const handleSaveUserCategory = async (userId: string, category: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        category: category
      });

      setUsers(users.map(u =>
        u.uid === userId ? { ...u, category } : u
      ));

      if (selectedUser?.uid === userId) {
        setSelectedUser({ ...selectedUser, category });
      }

      alert('✅ カテゴリーを保存しました');
    } catch (error) {
      console.error('カテゴリー保存エラー:', error);
      alert('❌ 保存に失敗しました');
    }
  };

  const savePermissions = async () => {
    if (!selectedUser || !permissions) return;

    console.log('=== 🔄 権限保存開始 ===');
    console.log('📧 ユーザー:', selectedUser.email);
    console.log('🔑 UID:', selectedUser.uid);
    console.log('📝 現在の権限オブジェクト:', permissions);
    console.log('📦 bulkUpload権限:', permissions.bulkUpload);

    try {
      const finalPermissions = { ...permissions };
      if (selectedUser.role === 'admin') {
        finalPermissions.accountManagement = true;
      }

      // undefined のフィールドを除外してクリーンなデータを作成
      const updateData: any = {
        permissions: finalPermissions
      };

      // 各フィールドが undefined でない場合のみ追加
      if (selectedUser.category !== undefined) {
        updateData.category = selectedUser.category || '';
      }
      if (selectedUser.knowledgeAccessLevel !== undefined) {
        updateData.knowledgeAccessLevel = selectedUser.knowledgeAccessLevel;
      }
      if (selectedUser.canDeleteKnowledge !== undefined) {
        updateData.canDeleteKnowledge = selectedUser.canDeleteKnowledge || false;
      }
      if (selectedUser.canEditKnowledge !== undefined) {
        updateData.canEditKnowledge = selectedUser.canEditKnowledge || false;
      }
      if (selectedUser.shiftDisplaySettings !== undefined) {
        updateData.shiftDisplaySettings = selectedUser.shiftDisplaySettings || {};
      }

      console.log('💾 Firestoreに保存するデータ:');
      console.log('  - permissions:', updateData.permissions);
      console.log('  - permissions.bulkUpload:', updateData.permissions.bulkUpload);
      console.log('  - クリーニング後のデータ:', updateData);
      console.log('🎯 保存先パス: users/' + selectedUser.uid);

      await updateDoc(doc(db, 'users', selectedUser.uid), updateData);

      console.log('✅ Firestore保存成功！');
      console.log('✅ 保存された bulkUpload:', finalPermissions.bulkUpload);

      setUsers(users.map(u =>
        u.uid === selectedUser.uid ? {
          ...u,
          permissions: finalPermissions,
          category: selectedUser.category,
          knowledgeAccessLevel: selectedUser.knowledgeAccessLevel,
          canDeleteKnowledge: selectedUser.canDeleteKnowledge || false,
          canEditKnowledge: selectedUser.canEditKnowledge || false,
          shiftDisplaySettings: selectedUser.shiftDisplaySettings || {}
        } : u
      ));

      alert('権限を更新しました');
    } catch (error) {
      console.error('=== 保存エラー ===');
      console.error('エラー詳細:', error);
      console.error('エラーメッセージ:', (error as Error).message);
      alert('保存に失敗しました: ' + (error as Error).message);
    }
  };

  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert('❌ すべての項目を入力してください');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        newUser.password
      );

      const defaultPermissions = DEFAULT_PERMISSIONS;

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        permissions: defaultPermissions,
        category: '',
        employmentType: '',
        phone: '',
        joinDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid
      });

      await fetchUsers();

      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'reception' });

      alert('✅ ユーザーを追加しました\n\n初期パスワードを本人に伝えてください。');
    } catch (error: any) {
      console.error('ユーザー追加エラー:', error);

      let errorMessage = 'ユーザーの追加に失敗しました';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'このメールアドレスは既に使用されています';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'パスワードは6文字以上にしてください';
      }

      alert('❌ ' + errorMessage);
    }
  };

  const deleteUser = async (user: User) => {
    if (user.uid === auth.currentUser?.uid) {
      alert('❌ 自分自身を削除することはできません');
      return;
    }

    const confirmed = window.confirm(
      `${user.name} (${user.email}) を削除しますか？\n\n` +
      `⚠️ 注意事項：\n` +
      `・このユーザーはログインできますが、アプリは使用できなくなります\n` +
      `・月1回、Firebase Consoleから完全削除してください\n` +
      `・この操作は取り消せません`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid));

      const updatedUsers = users.filter(u => u.uid !== user.uid);
      setUsers(updatedUsers);
      setSelectedUser(null);

      alert('✅ ユーザーを削除しました\n\n月1回、Firebase Consoleから完全削除を行ってください。');
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      alert('❌ ユーザーの削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">ユーザー一覧</h3>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-3 py-1 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm font-bold"
            style={{ minHeight: '36px' }}
          >
            + 追加
          </button>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {users.map(user => (
            <button
              key={user.uid}
              onClick={() => selectUser(user)}
              className={`w-full text-left p-3 rounded transition ${
                selectedUser?.uid === user.uid
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {user.category === '船長' ? '🚢' :
                   user.category === '浜スタッフ' ? '🏖️' :
                   user.category === '受付' ? '📝' : '👤'}
                </span>
                <div className="flex-1">
                  <div className="font-bold">{user.name}</div>
                  <div className="text-xs opacity-75">{user.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs">
                      {user.role === 'owner_executive' ? '👔 オーナー・役員' :
                       user.role === 'admin' ? '👨‍💼 管理者' :
                       user.role === 'captain' ? '⛵ 船長' :
                       user.role === 'beach_staff' ? '🏖️ 浜スタッフ' :
                       user.role === 'reception' ? '📞 受付' : '🖥️ 打刻端末'}
                    </span>
                    {user.category && user.category !== '未設定' && (
                      <span className="text-xs bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded">
                        {user.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {selectedUser && permissions ? (
          <>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🔐 {selectedUser.name} の権限設定
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="font-bold text-gray-900 dark:text-white">アカウント管理</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    他のユーザーの権限を管理できます
                    {selectedUser.role === 'admin' && (
                      <div className="text-yellow-500 text-xs mt-1">
                        ※ 管理者は常に有効です（変更不可）
                      </div>
                    )}
                    {selectedUser.role === 'owner_executive' && !permissions.accountManagement && (
                      <div className="text-orange-500 text-xs mt-1">
                        ⚠️ OFFにすると権限管理ができなくなります
                      </div>
                    )}
                  </div>
                </div>
                <ToggleSwitch
                  checked={
                    selectedUser.role === 'admin'
                      ? true
                      : permissions.accountManagement
                  }
                  onChange={handleAccountManagementToggle}
                  disabled={selectedUser.role === 'admin'}
                />
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-bold text-gray-900 dark:text-white mb-2">乗船管理</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => updatePermission('boardingManagement', 'none')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.boardingManagement === 'none'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    なし
                  </button>
                  <button
                    onClick={() => updatePermission('boardingManagement', 'view')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.boardingManagement === 'view'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    閲覧のみ
                  </button>
                  <button
                    onClick={() => updatePermission('boardingManagement', 'edit')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.boardingManagement === 'edit'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    編集可能
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-bold text-gray-900 dark:text-white mb-2">予約管理</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => updatePermission('reservationManagement', 'none')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.reservationManagement === 'none'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    なし
                  </button>
                  <button
                    onClick={() => updatePermission('reservationManagement', 'view')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.reservationManagement === 'view'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    閲覧のみ
                  </button>
                  <button
                    onClick={() => updatePermission('reservationManagement', 'edit')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.reservationManagement === 'edit'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    編集可能
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-bold text-gray-900 dark:text-white mb-2">シフト管理</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => updatePermission('shiftManagement', 'none')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.shiftManagement === 'none'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    なし
                  </button>
                  <button
                    onClick={() => updatePermission('shiftManagement', 'view')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.shiftManagement === 'view'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    閲覧のみ
                  </button>
                  <button
                    onClick={() => updatePermission('shiftManagement', 'edit')}
                    className={`px-4 py-2 rounded font-medium ${
                      permissions.shiftManagement === 'edit'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                    }`}
                  >
                    編集可能
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">メッセージ</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    スタッフ間のメッセージ機能を利用できます
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.messages}
                  onChange={(checked) => updatePermission('messages', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">打刻システム</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    出退勤の打刻ができます
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.timeClocking}
                  onChange={(checked) => updatePermission('timeClocking', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">気象情報</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    天気・海況情報を表示します
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.weatherInfo}
                  onChange={(checked) => updatePermission('weatherInfo', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">レポート</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    売上分析・経営レポートを閲覧できます
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.reports}
                  onChange={(checked) => updatePermission('reports', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">シフト表に反映</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    シフト表にこのユーザーを表示します
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.showInShift}
                  onChange={(checked) => updatePermission('showInShift', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">一括アップロード</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    過去データの一括取り込みができます
                  </div>
                </div>
                <ToggleSwitch
                  checked={permissions.bulkUpload || false}
                  onChange={(checked) => updatePermission('bulkUpload', checked)}
                />
              </div>

              {/* ナレッジベース削除権限 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">ナレッジベース削除</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ナレッジベースの文書を削除できます
                  </div>
                </div>
                <ToggleSwitch
                  checked={selectedUser.canDeleteKnowledge || false}
                  onChange={(checked) => {
                    setSelectedUser(prev => prev ? {...prev, canDeleteKnowledge: checked} : prev);
                  }}
                />
              </div>

              {/* ナレッジベース編集権限 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">ナレッジベース編集</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ナレッジベースの文書を編集できます
                  </div>
                </div>
                <ToggleSwitch
                  checked={selectedUser.canEditKnowledge || false}
                  onChange={(checked) => {
                    setSelectedUser(prev => prev ? {...prev, canEditKnowledge: checked} : prev);
                  }}
                />
              </div>

              {/* ナレッジベース閲覧レベル */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-bold text-gray-900 dark:text-white mb-2">ナレッジベース閲覧レベル</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  閲覧可能な機密レベルを設定（未設定の場合は役職に応じて自動設定されます）
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedUser(prev => prev ? {...prev, knowledgeAccessLevel: 0} : prev);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.knowledgeAccessLevel === 0
                        ? 'bg-gray-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    レベル 0（公開）
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(prev => prev ? {...prev, knowledgeAccessLevel: 1} : prev);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.knowledgeAccessLevel === 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    レベル 1（社内限定）
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(prev => prev ? {...prev, knowledgeAccessLevel: 2} : prev);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.knowledgeAccessLevel === 2
                        ? 'bg-yellow-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    レベル 2（機密）
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(prev => prev ? {...prev, knowledgeAccessLevel: 3} : prev);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.knowledgeAccessLevel === 3
                        ? 'bg-red-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    レベル 3（極秘）
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(prev => prev ? {...prev, knowledgeAccessLevel: undefined} : prev);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedUser.knowledgeAccessLevel === undefined
                        ? 'bg-green-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    自動設定
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">📅 シフト表示権限</h4>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium text-gray-900 dark:text-white">人件費の表示</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => updateShiftDisplaySetting('canViewPersonnelCost', false)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        !selectedUser.shiftDisplaySettings?.canViewPersonnelCost
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      非表示
                    </button>
                    <button
                      onClick={() => updateShiftDisplaySetting('canViewPersonnelCost', true)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedUser.shiftDisplaySettings?.canViewPersonnelCost
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      表示
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-900 dark:text-white">月間集計の表示</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => updateShiftDisplaySetting('canViewMonthlySummary', false)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        !selectedUser.shiftDisplaySettings?.canViewMonthlySummary
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      非表示
                    </button>
                    <button
                      onClick={() => updateShiftDisplaySetting('canViewMonthlySummary', true)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedUser.shiftDisplaySettings?.canViewMonthlySummary
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      表示
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-6">
              <div className="font-bold text-gray-900 dark:text-white mb-2">📋 カテゴリー</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                シフト管理で人数不足を判定する際に使用されます
              </p>
              <select
                value={selectedUser.category || '未設定'}
                onChange={(e) => setSelectedUser({ ...selectedUser, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                style={{ minHeight: '44px' }}
              >
                <option value="未設定">未設定</option>
                <option value="船長">🚢 船長</option>
                <option value="浜スタッフ">🏖️ 浜スタッフ</option>
                <option value="受付">📝 受付</option>
              </select>
            </div>

            <button
              onClick={savePermissions}
              className="w-full mt-6 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold"
              style={{ minHeight: '44px' }}
            >
              💾 権限を保存
            </button>

            <button
              onClick={() => deleteUser(selectedUser)}
              disabled={selectedUser.uid === auth.currentUser?.uid}
              className="w-full mt-4 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              {selectedUser.uid === auth.currentUser?.uid
                ? '⚠️ 自分自身は削除できません'
                : '🗑️ このユーザーを削除'}
            </button>

            {selectedUser.uid !== auth.currentUser?.uid && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                ※ ログインはできますが、アプリは使用できなくなります<br />
                ※ 月1回、Firebase Consoleから完全削除してください
              </p>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 dark:text-gray-500 py-12">
            左側からユーザーを選択してください
          </div>
        )}
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">👤 新規ユーザー登録</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">名前 *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="例: 田中 太郎"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">メールアドレス *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="例: tanaka@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">初期パスワード *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="6文字以上"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ※ ユーザーに初期パスワードを伝え、初回ログイン後に変更してもらってください
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">役割 *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  style={{ minHeight: '44px' }}
                >
                  <option value="owner_executive">👔 オーナー・役員</option>
                  <option value="admin">👨‍💼 管理者</option>
                  <option value="captain">⛵ 船長</option>
                  <option value="beach_staff">🏖️ 浜スタッフ</option>
                  <option value="reception">📞 受付</option>
                  <option value="kiosk">🖥️ 打刻端末</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUser({ name: '', email: '', password: '', role: 'reception' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                style={{ minHeight: '44px' }}
              >
                キャンセル
              </button>
              <button
                onClick={addUser}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold"
                style={{ minHeight: '44px' }}
              >
                登録
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftDisplaySettings() {
  const [targetLaborCostRatio, setTargetLaborCostRatio] = useState(40);
  const [saving, setSaving] = useState(false);
  const [staffRequirements, setStaffRequirements] = useState<{
    captain: number;
    beach_staff: number;
    reception: number;
  }>({
    captain: 2,
    beach_staff: 0,
    reception: 2
  });

  useEffect(() => {
    loadSettings();
    loadRequirements();
  }, []);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'shift_settings');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const ratio = data.staffCostRatio || data.salesTargetDivisor || 0.4;
        setTargetLaborCostRatio(ratio * 100);
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error);
    }
  };

  const loadRequirements = async () => {
    try {
      const settingsRef = doc(db, 'settings', 'shift_requirements');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        setStaffRequirements(settingsSnap.data() as any);
      }
    } catch (error) {
      console.error('必要人数読み込みエラー:', error);
    }
  };

  const updateRequirement = (key: 'captain' | 'beach_staff' | 'reception', value: number) => {
    setStaffRequirements(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveRequirements = async () => {
    setSaving(true);
    try {
      const settingsRef = doc(db, 'settings', 'shift_requirements');
      await setDoc(settingsRef, staffRequirements);
      alert('✅ 必要人数を保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('❌ 保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'shift_settings'), {
        staffCostRatio: targetLaborCostRatio / 100,
        salesTargetDivisor: targetLaborCostRatio / 100
      });
      alert('✅ 設定を保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('❌ 保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">シフト自動生成の条件</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          各カテゴリの必要人数を設定します。この設定に基づいて「ヘルプ募集」が表示されます。
        </p>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="w-40 font-medium text-gray-900 dark:text-white">船長の必要人数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={staffRequirements.captain}
              onChange={(e) => updateRequirement('captain', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-center"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">名</span>
          </div>

          <div className="flex items-center space-x-4">
            <label className="w-40 font-medium text-gray-900 dark:text-white">浜スタッフの必要人数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={staffRequirements.beach_staff}
              onChange={(e) => updateRequirement('beach_staff', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-center"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">名</span>
          </div>

          <div className="flex items-center space-x-4">
            <label className="w-40 font-medium text-gray-900 dark:text-white">受付の必要人数</label>
            <input
              type="number"
              min="0"
              max="10"
              value={staffRequirements.reception}
              onChange={(e) => updateRequirement('reception', parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-center"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">名</span>
          </div>

          <button
            onClick={saveRequirements}
            disabled={saving}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 mt-4"
          >
            {saving ? '保存中...' : '必要人数を保存'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="mb-3">
              <div className="font-bold text-gray-900 dark:text-white mb-1">売上目標の計算式</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                人件費を売上の何%にするかを設定します
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">目標人件費率</label>
              <input
                type="number"
                min="1"
                max="100"
                value={targetLaborCostRatio}
                onChange={(e) => setTargetLaborCostRatio(parseInt(e.target.value) || 40)}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-800 dark:text-white text-center"
                style={{ minHeight: '44px' }}
              />
              <span className="text-gray-700 dark:text-gray-300">%</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              売上に対する人件費の目標比率を設定します。<br />
              例: 人件費が100万円、人件費率40%の場合、売上目標は250万円となります。<br />
              <span className="text-gray-500 dark:text-gray-500">計算式: 売上目標 = 人件費 ÷ (人件費率 ÷ 100)</span>
            </p>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 font-bold"
            style={{ minHeight: '44px' }}
          >
            <Save className="w-5 h-5" />
            <span>{saving ? '保存中...' : '設定を保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface KnowledgeBaseSettingsProps {
  categories: any[];
  setCategories: (categories: any[]) => void;
  categoryDialogOpen: boolean;
  setCategoryDialogOpen: (open: boolean) => void;
  editingCategory: any | null;
  setEditingCategory: (category: any | null) => void;
  categoryName: string;
  setCategoryName: (name: string) => void;
  categoryValue: string;
  setCategoryValue: (value: string) => void;
  categoryIcon: string;
  setCategoryIcon: (icon: string) => void;
  handleDeleteCategory: (categoryId: string) => void;
}

function KnowledgeBaseSettings({
  categories,
  categoryDialogOpen,
  setCategoryDialogOpen,
  editingCategory,
  setEditingCategory,
  categoryName,
  setCategoryName,
  categoryValue,
  setCategoryValue,
  categoryIcon,
  setCategoryIcon,
  handleDeleteCategory,
}: KnowledgeBaseSettingsProps) {

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">カテゴリー管理</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ナレッジベースのカテゴリーを管理します
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setCategoryName('');
            setCategoryValue('');
            setCategoryIcon('');
            setCategoryDialogOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          カテゴリー追加
        </button>
      </div>

      <div className="grid gap-4">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            カテゴリーがありません。「カテゴリー追加」ボタンから追加してください。
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{category.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    値: {category.value}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingCategory(category);
                    setCategoryName(category.name);
                    setCategoryValue(category.value);
                    setCategoryIcon(category.icon);
                    setCategoryDialogOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface SystemSettingsProps {
  theme: string;
  setTheme: (theme: string) => void;
  currentUser: User | null;
}

function SystemSettings({ theme, setTheme, currentUser }: SystemSettingsProps) {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner_executive': return 'オーナー・役員';
      case 'admin': return '管理者';
      case 'captain': return '船長';
      case 'beach_staff': return '浜スタッフ';
      case 'reception': return '受付';
      case 'kiosk': return '打刻端末';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Palette className="w-6 h-6 mr-2 text-teal-500" />
          外観
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            style={{ minHeight: '80px' }}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">☀️</div>
              <p className="font-medium text-gray-900 dark:text-white">ライトモード</p>
            </div>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            style={{ minHeight: '80px' }}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">🌙</div>
              <p className="font-medium text-gray-900 dark:text-white">ダークモード</p>
            </div>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === 'system'
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            style={{ minHeight: '80px' }}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">💻</div>
              <p className="font-medium text-gray-900 dark:text-white">システム設定</p>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <UserIcon className="w-6 h-6 mr-2 text-teal-500" />
          アカウント情報
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <UserIcon className="w-4 h-4 mr-1" />
              表示名
            </label>
            <input
              type="text"
              value={currentUser?.name || ''}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50"
              style={{ minHeight: '44px' }}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Mail className="w-4 h-4 mr-1" />
              メールアドレス
            </label>
            <input
              type="email"
              value={currentUser?.email || ''}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50"
              style={{ minHeight: '44px' }}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Briefcase className="w-4 h-4 mr-1" />
              役割
            </label>
            <input
              type="text"
              value={currentUser?.role ? getRoleLabel(currentUser.role) : ''}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50"
              style={{ minHeight: '44px' }}
              disabled
            />
          </div>

          <button
            onClick={() => alert('パスワード変更機能は今後実装予定です')}
            className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium flex items-center justify-center"
            style={{ minHeight: '44px' }}
          >
            <Lock className="w-4 h-4 mr-2" />
            パスワードを変更
          </button>
        </div>
      </div>
    </div>
  );
}
