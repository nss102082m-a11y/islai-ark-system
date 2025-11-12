import { useState, useEffect } from 'react';
import { fetchCurrentWeather, getWeatherInfo, parseWindSpeed } from '../utils/weatherHelpers';

export function CurrentWeather() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [realTimeWindSpeed, setRealTimeWindSpeed] = useState<number>(0);

  useEffect(() => {
    const updateWeather = async () => {
      try {
        const weatherData = await fetchCurrentWeather();
        setWeather(weatherData);
        const estimatedSpeed = parseWindSpeed(weatherData.wind);
        setRealTimeWindSpeed(estimatedSpeed);
      } catch (error) {
        console.error('天気取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    updateWeather();
    const interval = setInterval(updateWeather, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-teal-500 rounded-lg shadow-md p-8 text-white">
        <div className="text-center py-8">読み込み中...</div>
      </div>
    );
  }

  if (!weather || weather.error) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-teal-500 rounded-lg shadow-md p-8 text-white">
        <div className="text-center py-8">
          <div className="text-xl mb-2">⚠️ 天気情報を取得できませんでした</div>
          <div className="text-sm opacity-75">しばらくしてから再度お試しください</div>
        </div>
      </div>
    );
  }

  const weatherInfo = getWeatherInfo(weather.weatherCode);

  return (
    <div className={`bg-gradient-to-br ${weatherInfo.color} rounded-lg shadow-md p-8 text-white`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">川平湾</h2>
          <p className="text-sm opacity-90">石垣島 八重山地方</p>
          <p className="text-lg mt-1 opacity-95">{weatherInfo.status}</p>
        </div>
        <div className="text-6xl">{weatherInfo.icon}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <div className="text-sm opacity-75 mb-1">🌡️ 気温</div>
          <div className="text-2xl font-bold">{weather.temp}°C</div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <div className="text-sm opacity-75 mb-1">💨 風</div>
          <div className="text-lg font-medium">{weather.wind.split('　')[0]}</div>
          <div className="text-sm font-bold mt-1">({realTimeWindSpeed}m/s)</div>
          <div className="text-xs opacity-75 mt-1">※気象庁データから推定</div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <div className="text-sm opacity-75 mb-1">🌊 波</div>
          <div className="text-lg font-medium">{weather.wave}</div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <div className="text-sm opacity-75 mb-1">💧 降水確率</div>
          <div className="text-2xl font-bold">{weather.pop}%</div>
        </div>
      </div>

      <div className="mt-4 text-sm opacity-75">
        ※気象庁データより（10分ごとに更新）
      </div>
    </div>
  );
}
