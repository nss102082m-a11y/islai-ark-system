import { Wind, Waves, Eye } from 'lucide-react';

interface OperationGuidelinesProps {
  currentWindSpeed: number;
  currentWaveHeight: number;
  currentVisibility: number;
}

interface GuidelineLevel {
  label: string;
  icon: string;
  status: string;
  range: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export default function OperationGuidelines({
  currentWindSpeed,
  currentWaveHeight,
  currentVisibility
}: OperationGuidelinesProps) {
  const windLevels: GuidelineLevel[] = [
    {
      label: '良好',
      icon: '🟢',
      status: '通常運航',
      range: '0-8 m/s',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-900 dark:text-green-100',
      borderColor: 'border-green-500'
    },
    {
      label: '注意',
      icon: '🟡',
      status: '慎重に判断',
      range: '9-12 m/s',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      borderColor: 'border-yellow-500'
    },
    {
      label: '警戒',
      icon: '🔴',
      status: '運航見合わせ検討',
      range: '13 m/s~',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-900 dark:text-red-100',
      borderColor: 'border-red-500'
    }
  ];

  const waveLevels: GuidelineLevel[] = [
    {
      label: '良好',
      icon: '🟢',
      status: '通常運航',
      range: '0-0.9 m',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-900 dark:text-green-100',
      borderColor: 'border-green-500'
    },
    {
      label: '注意',
      icon: '🟡',
      status: '揺れあり',
      range: '1.0-2.9 m',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      borderColor: 'border-yellow-500'
    },
    {
      label: '警戒',
      icon: '🔴',
      status: '運航中止推奨',
      range: '3.0 m~',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-900 dark:text-red-100',
      borderColor: 'border-red-500'
    }
  ];

  const visibilityLevels: GuidelineLevel[] = [
    {
      label: '良好',
      icon: '🟢',
      status: '通常運航',
      range: '1000 m~',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-900 dark:text-green-100',
      borderColor: 'border-green-500'
    },
    {
      label: '注意',
      icon: '🟡',
      status: '視界不良',
      range: '500-999 m',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      borderColor: 'border-yellow-500'
    },
    {
      label: '警戒',
      icon: '🔴',
      status: '運航中止推奨',
      range: '0-499 m',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-900 dark:text-red-100',
      borderColor: 'border-red-500'
    }
  ];

  const getCurrentWindLevel = () => {
    console.log('判定用風速:', currentWindSpeed, 'm/s');
    if (currentWindSpeed <= 8) return 0;
    if (currentWindSpeed <= 12) return 1;
    return 2;
  };

  const getCurrentWaveLevel = () => {
    console.log('判定用波高:', currentWaveHeight, 'm');
    let level = 0;
    if (currentWaveHeight >= 3.0) {
      level = 2;
    } else if (currentWaveHeight >= 1.0) {
      level = 1;
    }
    console.log('波高ステータス:', ['良好', '注意', '警戒'][level]);
    return level;
  };

  const getCurrentVisibilityLevel = () => {
    if (currentVisibility >= 1000) return 0;
    if (currentVisibility >= 500) return 1;
    return 2;
  };

  const renderGuideline = (
    title: string,
    icon: React.ReactNode,
    levels: GuidelineLevel[],
    currentLevel: number,
    currentValue: string
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">現在: {currentValue}</p>
        </div>
      </div>

      <div className="space-y-3">
        {levels.map((level, index) => {
          const isActive = index === currentLevel;
          return (
            <div
              key={index}
              className={`
                p-4 rounded-lg transition-all
                ${isActive ? `${level.bgColor} border-4 ${level.borderColor}` : 'bg-gray-50 dark:bg-gray-700/30 border-2 border-transparent'}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{level.icon}</span>
                  <span className={`font-semibold ${isActive ? level.textColor : 'text-gray-600 dark:text-gray-400'}`}>
                    {level.label}
                  </span>
                </div>
                <span className={`text-sm font-medium ${isActive ? level.textColor : 'text-gray-500 dark:text-gray-500'}`}>
                  {level.range}
                </span>
              </div>
              <p className={`text-sm ${isActive ? level.textColor : 'text-gray-600 dark:text-gray-500'}`}>
                {level.status}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        運航判断の目安
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderGuideline(
          '風速の目安',
          <Wind className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
          windLevels,
          getCurrentWindLevel(),
          `${currentWindSpeed} m/s`
        )}
        {renderGuideline(
          '波高の目安',
          <Waves className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
          waveLevels,
          getCurrentWaveLevel(),
          `${currentWaveHeight} m`
        )}
        {renderGuideline(
          '視界の目安',
          <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
          visibilityLevels,
          getCurrentVisibilityLevel(),
          `${currentVisibility} m`
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">注意: </span>
          これらは一般的な目安です。実際の運航判断は、船長の経験や船の性能、海域の特性なども考慮して総合的に行ってください。
        </p>
      </div>
    </div>
  );
}
