import { ArrowUp, ArrowDown } from 'lucide-react';
import { TideData, Tide } from '../utils/tideHelpers';

interface TideScrollViewProps {
  tideDataList: TideData[];
  selectedDate: Date;
}

export default function TideScrollView({ tideDataList, selectedDate }: TideScrollViewProps) {
  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isSelected = (dateStr: string) => {
    const selected = selectedDate.toISOString().split('T')[0];
    return dateStr === selected;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${month}/${day} (${weekday})`;
  };

  const getTideStatus = (tides: Tide[]) => {
    // 防御的チェック
    if (!tides || tides.length === 0) {
      return 'データなし';
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 各潮汐を時刻（分）に変換
    const tidesWithMinutes = tides
      .filter(tide => tide && tide.time && tide.type)
      .map(tide => {
        const [hours, minutes] = tide.time.split(':').map(Number);
        return {
          ...tide,
          minutes: hours * 60 + minutes
        };
      })
      .sort((a, b) => a.minutes - b.minutes);

    if (tidesWithMinutes.length === 0) {
      console.warn('[TIDE] 有効な潮汐データがありません');
      return 'データなし';
    }

    let prevTide = tidesWithMinutes[tidesWithMinutes.length - 1];
    for (const tide of tidesWithMinutes) {
      if (tide.minutes <= currentMinutes) {
        prevTide = tide;
      }
    }

    return prevTide.type === 'low' ? '上げ潮' : '下げ潮';
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex gap-4 min-w-max px-2">
          {tideDataList.map((tideData) => {
            const today = isToday(tideData.date);
            const selected = isSelected(tideData.date);
            const status = getTideStatus(tideData.tides);

            const highTides = tideData.tides.filter(t => t.type === 'high');
            const lowTides = tideData.tides.filter(t => t.type === 'low');

            return (
              <div
                key={tideData.date}
                className={`
                  flex-shrink-0 w-72 rounded-lg p-4 transition-all
                  ${selected
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-600 dark:ring-blue-400'
                    : today
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-500 dark:ring-yellow-400'
                    : 'bg-white dark:bg-gray-800'
                  }
                  shadow-md hover:shadow-lg
                `}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-lg font-semibold ${
                    selected || today ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                  }`}>
                    {formatDate(tideData.date)}
                  </h3>
                  {today && (
                    <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full">
                      今日
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUp className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">満潮</span>
                    </div>
                    {highTides.map((tide, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-red-50 dark:bg-red-900/20 rounded mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{tide.time}</span>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">{tide.level}cm</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDown className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">干潮</span>
                    </div>
                    {lowTides.map((tide, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-blue-50 dark:bg-blue-900/20 rounded mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{tide.time}</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{tide.level}cm</span>
                      </div>
                    ))}
                  </div>

                  {today && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">現在: {status}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
