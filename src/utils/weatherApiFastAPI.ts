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

    if (!result.success) {
      throw new Error(result.error || 'データ取得に失敗しました');
    }

    // キャッシュに保存
    cache.set('weather', {
      data: result.data,
      timestamp: Date.now()
    });

    console.log('[FastAPI] ✅ 天気データ取得完了');
    return result.data;

  } catch (error) {
    console.error('[FastAPI] ❌ エラー:', error);
    throw error;
  }
};
