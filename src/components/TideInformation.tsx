import { useState, useEffect } from 'react';
import { TideData, CurrentTide, calculateCurrentTide } from '../utils/tideHelpers';
import { TideChart } from './TideChart';

interface TideInformationProps {
  tideData: TideData | null;
}

export function TideInformation({ tideData }: TideInformationProps) {
  const [currentTide, setCurrentTide] = useState<CurrentTide | null>(null);

  useEffect(() => {
    if (!tideData?.tides) return;

    const updateTide = () => {
      setCurrentTide(calculateCurrentTide(tideData.tides));
    };

    updateTide();
    const interval = setInterval(updateTide, 60000);

    return () => clearInterval(interval);
  }, [tideData]);

  const todayHighTides = tideData?.tides.filter(t => t.type === 'high') || [];
  const todayLowTides = tideData?.tides.filter(t => t.type === 'low') || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🌊 本日の潮汐情報</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="font-bold mb-2 text-blue-500 dark:text-blue-400">満潮・干潮</h4>
          <div className="space-y-2">
            {todayHighTides.map((tide, idx) => (
              <div key={`high-${idx}`} className="text-sm bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
                🌊 満潮: {tide.time} ({tide.level}cm)
              </div>
            ))}
            {todayLowTides.map((tide, idx) => (
              <div key={`low-${idx}`} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                🏖️ 干潮: {tide.time} ({tide.level}cm)
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-2 text-teal-500 dark:text-teal-400">現在の潮位</h4>
          {currentTide ? (
            <div className="bg-teal-50 dark:bg-teal-900/30 p-4 rounded text-center">
              <div className="text-5xl font-bold text-teal-600 dark:text-teal-300">
                {currentTide.level}
                <span className="text-2xl">cm</span>
              </div>
              <div className={`text-lg mt-2 font-bold ${
                currentTide.isRising ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {currentTide.isRising ? '⬆️ 上げ潮' : '⬇️ 下げ潮'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                次の{currentTide.nextTide.type === 'high' ? '満潮' : '干潮'}まで
                {currentTide.timeUntilNext}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded text-center text-gray-500 dark:text-gray-400">
              データを読み込み中...
            </div>
          )}
        </div>

        <div>
          <h4 className="font-bold mb-2 text-yellow-500 dark:text-yellow-400">✨ おすすめ時間</h4>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              準備中...
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-bold mb-2 text-gray-900 dark:text-white">📊 本日の潮汐グラフ</h4>
        <TideChart tides={tideData?.tides || []} currentTide={currentTide} />
      </div>
    </div>
  );
}
