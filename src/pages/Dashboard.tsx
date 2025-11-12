import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Ship, DollarSign, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculateMonthlyRevenue } from '../utils/revenueCalculator';

export function Dashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    todayReservations: 0,
    monthlyRevenue: 0,
    activeStaff: 0,
    recentReservations: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      const reservationsRef = collection(db, 'reservations');
      const todayQuery = query(reservationsRef, where('date', '==', today));
      const todaySnapshot = await getDocs(todayQuery);

      const now = new Date();
      const monthRevenue = await calculateMonthlyRevenue(now.getFullYear(), now.getMonth() + 1);

      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);

      const recentReservations: any[] = [];
      todaySnapshot.forEach(doc => {
        recentReservations.push({ id: doc.id, ...doc.data() });
      });

      setStats({
        todayReservations: todaySnapshot.size,
        monthlyRevenue: monthRevenue,
        activeStaff: usersSnapshot.size,
        recentReservations: recentReservations.slice(0, 5)
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, label, value, color }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ダッシュボード
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ようこそ、{currentUser?.name}さん
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<Calendar className="w-6 h-6 text-teal-500" />}
            label="本日の予約"
            value={stats.todayReservations}
            color="#14b8a6"
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6 text-yellow-500" />}
            label="今月の売上"
            value={`¥${stats.monthlyRevenue.toLocaleString()}`}
            color="#eab308"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-blue-500" />}
            label="アクティブスタッフ"
            value={stats.activeStaff}
            color="#3b82f6"
          />
          <StatCard
            icon={<Ship className="w-6 h-6 text-purple-500" />}
            label="運航中"
            value="3隻"
            color="#a855f7"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            本日の予約一覧
          </h2>

          {stats.recentReservations.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              本日の予約はまだありません
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentReservations.map(reservation => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reservation.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {reservation.time} - {reservation.adults}名（大人） {reservation.children > 0 && `${reservation.children}名（子供）`}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    reservation.status === 'confirmed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : reservation.status === 'checked_in'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {reservation.status === 'confirmed' ? '確認済み' :
                     reservation.status === 'checked_in' ? 'チェックイン済み' : '保留中'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            今日のタスク
          </h2>
          <div className="space-y-2">
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input type="checkbox" className="w-5 h-5 text-teal-500 rounded" />
              <span className="ml-3 text-gray-900 dark:text-white">船舶の点検</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input type="checkbox" className="w-5 h-5 text-teal-500 rounded" />
              <span className="ml-3 text-gray-900 dark:text-white">安全装備の確認</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input type="checkbox" className="w-5 h-5 text-teal-500 rounded" />
              <span className="ml-3 text-gray-900 dark:text-white">気象情報の確認</span>
            </label>
          </div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧪</span>
            <h3 className="font-bold text-gray-900">開発用テストリンク</h3>
          </div>
          <a
            href="/daily-closing"
            className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors"
          >
            🔒 営業締めページへ移動
          </a>
        </div>
      </div>
    </Layout>
  );
}
