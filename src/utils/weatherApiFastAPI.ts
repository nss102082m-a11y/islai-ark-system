// FastAPI用の気象情報取得

const WEATHER_API_URL = 'http://127.0.0.1:8787/api/weather/';

// キャッシュ
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10分

export const fetchWeatherFromFastAPI = async () => {
  try {
    // キャッシュチェック
    const cached = cache.get('weather');
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[FastAPI] ✅ キャッシュから取得');
      return cached.data;
    }

    console.log('[FastAPI] 🌐 天気データ取得開始');
    const response = await fetch(WEATHER_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[FastAPI] 📡 受信データ:', result);

    if (!result.success) {
      throw new Error(result.error || 'データ取得に失敗しました');
    }

    // FastAPIのデータ構造に合わせて変換
    const forecast = result.data.forecast;
    if (!forecast) {
      throw new Error('天気予報データが見つかりません');
    }

    // CurrentWeatherコンポーネントで使用する形式に変換
    const weatherData = {
      weather: forecast.weather || '情報なし',
      weatherCode: getWeatherCode(forecast.weather),
      temp: `${forecast.temp_max}`,
      tempMin: forecast.temp_min,
      tempMax: forecast.temp_max,
      wind: forecast.wind || '情報なし',
      wave: forecast.wave || '情報なし',
      waveHeight: forecast.wave_height || 0,
      pop: '0', // FastAPIから降水確率が来ない場合のデフォルト
      windSpeed: 0 // 風速データがない場合
    };

    console.log('[FastAPI] ✅ 変換後データ:', weatherData);

    // キャッシュに保存
    cache.set('weather', {
      data: weatherData,
      timestamp: Date.now()
    });

    console.log('[FastAPI] ✅ 天気データ取得完了');
    return weatherData;

  } catch (error) {
    console.error('[FastAPI] ❌ エラー:', error);
    throw error;
  }
};

// 天気テキストから天気コードを推定
function getWeatherCode(weather: string): string {
  if (!weather) return '100';

  if (weather.includes('晴')) return '100';
  if (weather.includes('曇') || weather.includes('くもり')) return '200';
  if (weather.includes('雨')) {
    if (weather.includes('大雨')) return '301';
    return '300';
  }
  if (weather.includes('雪')) return '400';
  if (weather.includes('雷')) return '350';

  return '100'; // デフォルト：晴れ
}
