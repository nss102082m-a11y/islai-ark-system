import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { ReservationDetail } from '../components/ReservationDetail';
import {
  Calendar,
  List,
  RefreshCw,
  Download,
  Settings,
  Search,
  X,
  Filter,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  FileCheck
} from 'lucide-react';
import {
  Reservation,
  ReservationStatus,
  ReservationChannel,
  ReservationFilters,
  STATUS_COLORS,
  STATUS_LABELS,
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  CHANNEL_ICONS
} from '../types/reservation';
import {
  getReservations,
  syncReservationsFromGAS,
  fetchNewReservationsFromEmail,
  calculateReservationStats
} from '../services/reservationService';

type ViewMode = 'list' | 'calendar';

const STATUS_ICONS: Record<ReservationStatus, React.ReactNode> = {
  confirmed: <CheckCircle className="w-4 h-4" />,
  pending: <Clock className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
  completed: <FileCheck className="w-4 h-4" />
};

export default function ReservationManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [filters, setFilters] = useState<ReservationFilters>({
    status: [],
    channel: [],
    dateFrom: '',
    dateTo: '',
    searchQuery: ''
  });

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    try {
      setLoading(true);
      const data = await getReservations();
      setReservations(data);
    } catch (error) {
      console.error('予約データの取得に失敗しました:', error);
      alert('予約データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (syncing) return;

    try {
      setSyncing(true);
      const syncResult = await syncReservationsFromGAS();

      if (syncResult.success) {
        await loadReservations();
        alert(`✅ 同期完了！\n取得件数: ${syncResult.count}件`);
      } else {
        alert(`同期に失敗しました: ${syncResult.error}`);
      }
    } catch (error) {
      console.error('同期エラー:', error);
      alert('同期中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  }

  function handleExportCSV() {
    alert('CSV出力機能は実装中です');
  }

  function handleSettings() {
    alert('設定機能は実装中です');
  }

  const filteredReservations = useMemo(() => {
    let result = [...reservations];

    if (filters.status && filters.status.length > 0) {
      result = result.filter(r => filters.status!.includes(r.status));
    }

    if (filters.channel && filters.channel.length > 0) {
      result = result.filter(r => filters.channel!.includes(r.channel));
    }

    if (filters.dateFrom) {
      result = result.filter(r => r.checkIn >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      result = result.filter(r => r.checkIn <= filters.dateTo!);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(r =>
        r.guestName.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        r.phoneNumber?.includes(query) ||
        r.reservationNumber?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [reservations, filters]);

  const stats = useMemo(() => {
    return calculateReservationStats(filteredReservations);
  }, [filteredReservations]);

  function handleStatusChange(status: string) {
    if (status === 'all') {
      setFilters(prev => ({ ...prev, status: [] }));
    } else {
      setFilters(prev => ({ ...prev, status: [status as ReservationStatus] }));
    }
  }

  function handleChannelChange(channel: string) {
    if (channel === 'all') {
      setFilters(prev => ({ ...prev, channel: [] }));
    } else {
      setFilters(prev => ({ ...prev, channel: [channel as ReservationChannel] }));
    }
  }

  function clearFilters() {
    setFilters({
      status: [],
      channel: [],
      dateFrom: '',
      dateTo: '',
      searchQuery: ''
    });
  }

  const hasActiveFilters = filters.status?.length! > 0 || filters.channel?.length! > 0 || filters.dateFrom || filters.dateTo || filters.searchQuery;

  const confirmedCount = filteredReservations.filter(r => r.status === 'confirmed').length;
  const pendingCount = filteredReservations.filter(r => r.status === 'pending').length;
  const cancelledCount = filteredReservations.filter(r => r.status === 'cancelled').length;

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${month}/${day}(${weekday})`;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">予約データを読み込み中...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto p-6">

          {/* 1. ヘッダー（一番上） */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              📅 予約管理
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                同期
              </button>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={handleSettings}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. フィルターバー */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  開始日
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  終了日
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  チャネル
                </label>
                <select
                  value={filters.channel?.[0] || 'all'}
                  onChange={(e) => handleChannelChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">すべて</option>
                  <option value="jalan">じゃらん</option>
                  <option value="rakuten">楽天トラベル</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="direct">直接予約</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  検索
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="顧客名・電話番号・予約番号で検索"
                    value={filters.searchQuery}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2 transition-colors text-sm"
                >
                  <X className="w-4 h-4" />
                  クリア
                </button>
              </div>
            )}
          </div>

          {/* 3. 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">全予約</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{filteredReservations.length}</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">確定</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{confirmedCount}</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800 p-6">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">保留</p>
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{pendingCount}</p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">キャンセル</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-400">{cancelledCount}</p>
            </div>
          </div>

          {/* 4. ビュー切替 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 p-4">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
              <button
                onClick={() => setViewMode('list')}
                className={`px-6 py-2 rounded-md flex items-center gap-2 transition-colors font-medium ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <List className="w-4 h-4" />
                リスト
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-6 py-2 rounded-md flex items-center gap-2 transition-colors font-medium ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                カレンダー
              </button>
            </div>
          </div>

          {/* 5. 予約一覧 */}

          {viewMode === 'list' ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  予約一覧 ({filteredReservations.length}件)
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredReservations.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">予約がありません</p>
                  </div>
                ) : (
                  filteredReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      onClick={() => setSelectedReservation(reservation)}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${STATUS_COLORS[reservation.status]}`}>
                              {STATUS_ICONS[reservation.status]}
                              {STATUS_LABELS[reservation.status]}
                            </span>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${CHANNEL_COLORS[reservation.channel]}`}>
                              {CHANNEL_ICONS[reservation.channel]} {CHANNEL_LABELS[reservation.channel]}
                            </span>
                            {reservation.reservationNumber && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                #{reservation.reservationNumber}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <span className="text-gray-600 dark:text-gray-300">
                                  {reservation.date
                                    ? new Date(reservation.date).toLocaleDateString('ja-JP', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        weekday: 'short'
                                      })
                                    : '日付未設定'}
                                </span>
                              </div>

                              {reservation.time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                  <span className="text-teal-600 dark:text-teal-400 font-medium">
                                    {reservation.time}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">👤</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {reservation.guestName}
                                </span>
                              </div>
                              {reservation.phoneNumber && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">📱</span>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {reservation.phoneNumber}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">👥</span>
                                <span className="text-gray-700 dark:text-gray-300">
                                  {reservation.guests}名
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">💰</span>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                  ¥{reservation.totalAmount.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {reservation.roomType && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">📝</span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {reservation.roomType}
                                </span>
                              </div>
                            )}

                            {reservation.specialRequests && (
                              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                  💬 {reservation.specialRequests}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <Calendar className="w-24 h-24 mx-auto mb-6 text-gray-300 dark:text-gray-600" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                カレンダービュー
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                実装中です
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedReservation && (
        <ReservationDetail
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdate={() => {
            loadReservations();
            setSelectedReservation(null);
          }}
        />
      )}
    </Layout>
  );
}
