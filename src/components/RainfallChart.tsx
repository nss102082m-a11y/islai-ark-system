import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HourlyForecast } from '../utils/weatherHelpers';

interface RainfallChartProps {
  data: HourlyForecast[];
}

export default function RainfallChart({ data }: RainfallChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {payload[0].payload.time}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            降水確率: {payload[0].payload.pop}%
          </p>
        </div>
      );
    }
    return null;
  };

  const maxPop = Math.max(...data.map(d => d.pop), 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          降水確率（24時間）
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          気象庁APIから取得した降水確率データ
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="pop"
            fill="url(#rainfallGradient)"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {data.slice(0, 8).map((item, idx) => (
          <div
            key={idx}
            className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-center"
          >
            <p className="text-xs text-gray-600 dark:text-gray-400">{item.time}</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {item.pop}%
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">降水確率: </span>
          雨が降る可能性をパーセントで表示
        </p>
      </div>
    </div>
  );
}
