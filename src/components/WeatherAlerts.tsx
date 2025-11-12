import { useState, useEffect } from 'react';
import { fetchWarnings } from '../utils/weatherHelpers';

export function WeatherAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        console.log('[WeatherAlerts] 📡 警報データ取得開始');
        const alertsData = await fetchWarnings();

        console.log('[WeatherAlerts] 📊 取得した警報数:', alertsData.length);
        console.log('[WeatherAlerts] 📋 警報リスト:', alertsData);

        setAlerts(alertsData);
      } catch (error) {
        console.error('[WeatherAlerts] ❌ 警報取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">⚠️ 気象警報・注意報</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          読み込み中...
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">⚠️ 気象警報・注意報</h3>
        <div className="text-center py-8 text-green-600 dark:text-green-400 font-bold">
          ✅ 現在、警報・注意報は発表されていません
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">⚠️ 気象警報・注意報</h3>
      <div className="space-y-3">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border-l-4 ${
              alert.level === 'warning'
                ? 'bg-red-50 dark:bg-red-900/30 border-red-500'
                : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {alert.level === 'warning' ? '🚨' : '⚠️'}
              </span>
              <div className="flex-1">
                <div className="font-bold text-lg text-gray-900 dark:text-white">{alert.title}</div>
                <div className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                  {alert.status === '発表' ? '発表中' : alert.status}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
