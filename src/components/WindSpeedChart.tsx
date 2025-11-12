import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format24HourWindData } from '../utils/weatherHelpers';
import { TrendingUp } from 'lucide-react';

interface WindSpeedChartProps {
  data: any[];
  kaihoData: any[];
  realTimeWindSpeed: number;
}

export default function WindSpeedChart({ data, kaihoData, realTimeWindSpeed }: WindSpeedChartProps) {
  const chartData = format24HourWindData(kaihoData);

  const getWindColor = (speed: number) => {
    if (speed >= 13) return '#ef4444';
    if (speed >= 9) return '#f59e0b';
    return '#10b981';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const speed = payload[0].value;
      const color = getWindColor(speed);
      const direction = payload[0].payload.direction;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {payload[0].payload.time}
          </p>
          <p className="text-sm font-bold" style={{ color }}>
            風速: {speed} m/s
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            風向: {direction}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
        <TrendingUp className="w-6 h-6 text-cyan-500" />
        風速推移（24時間）
      </h3>

      <div className="mb-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-gray-600 dark:text-gray-400">良好 (0-8m/s)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-gray-600 dark:text-gray-400">注意 (9-12m/s)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">警戒 (13m/s~)</span>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
            <XAxis
              dataKey="time"
              className="fill-gray-600 dark:fill-gray-400"
              tick={{ fill: 'currentColor', fontSize: 12 }}
            />
            <YAxis
              className="fill-gray-600 dark:fill-gray-400"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              label={{ value: 'm/s', angle: -90, position: 'insideLeft', style: { fill: 'currentColor' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#06b6d4"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color = getWindColor(payload.speed);
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
            />
            <ReferenceLine y={13} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "警戒", fill: "#ef4444", position: "right" }} />
            <ReferenceLine y={9} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "注意", fill: "#f59e0b", position: "right" }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
          風速データを読み込み中...
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              現在の風速: <span className="text-lg font-bold" style={{ color: getWindColor(realTimeWindSpeed) }}>{realTimeWindSpeed} m/s</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              ※気象庁データから推定（24時間推移はシミュレーション）
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
