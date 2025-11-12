import { useState, useEffect } from 'react';
import { fetchTideDataForYear, parseTideDataForDate, TideInfo } from '../utils/tideHelpers';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface TideDateSelectorProps {
  onClose?: () => void;
}

export function TideDateSelector({ onClose }: TideDateSelectorProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tideData, setTideData] = useState<TideInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadTideDataForDate(selectedDate);
  }, [selectedDate]);

  const loadTideDataForDate = async (date: Date) => {
    setLoading(true);
    setError(null);

    try {
      const year = date.getFullYear();
      const textData = await fetchTideDataForYear(year);

      if (!textData) {
        setError('データを取得できませんでした');
        setTideData(null);
        setLoading(false);
        return;
      }

      const tides = parseTideDataForDate(textData, date);

      if (!tides || tides.length === 0) {
        setError('該当日のデータがありません');
        setTideData(null);
      } else {
        setTideData(tides);
      }
    } catch (err) {
      console.error('潮汐データ取得エラー:', err);
      setError('データの読み込みに失敗しました');
      setTideData(null);
    }

    setLoading(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getNextTide = () => {
    if (!tideData || tideData.length === 0) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const isToday =
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();

    if (!isToday) return null;

    for (const tide of tideData) {
      const [hours, minutes] = tide.time.split(':').map(Number);
      const tideMinutes = hours * 60 + minutes;

      if (tideMinutes > currentMinutes) {
        return tide;
      }
    }

    return null;
  };

  const nextTide = getNextTide();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          潮汐カレンダー
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-lg font-semibold">
            {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
          </div>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
            >
              {day}
            </div>
          ))}
          {blanks.map((i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {days.map((day) => (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                transition-colors
                ${
                  isSelected(day)
                    ? 'bg-blue-600 text-white'
                    : isToday(day)
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                }
              `}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📅 {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の潮汐情報
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">読み込み中...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!loading && !error && tideData && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                🌊 満潮
              </h4>
              <div className="space-y-2">
                {tideData
                  .filter((tide) => tide.type === 'high')
                  .map((tide, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        nextTide?.time === tide.time
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <span className="font-mono text-lg">{tide.time}</span>
                      <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                        {tide.level} cm
                      </span>
                      {nextTide?.time === tide.time && (
                        <span className="text-sm text-yellow-700 dark:text-yellow-300">
                          ← 次の満潮
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                🌊 干潮
              </h4>
              <div className="space-y-2">
                {tideData
                  .filter((tide) => tide.type === 'low')
                  .map((tide, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        nextTide?.time === tide.time
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <span className="font-mono text-lg">{tide.time}</span>
                      <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                        {tide.level} cm
                      </span>
                      {nextTide?.time === tide.time && (
                        <span className="text-sm text-yellow-700 dark:text-yellow-300">
                          ← 次の干潮
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
