import { useState, useEffect } from 'react';
import { Calendar, RotateCcw } from 'lucide-react';
import { Layout } from '../components/Layout';
import { TideInformation } from '../components/TideInformation';
import { WeatherAlerts } from '../components/WeatherAlerts';
import { CurrentWeather } from '../components/CurrentWeather';
import TideCalendar from '../components/TideCalendar';
import TideScrollView from '../components/TideScrollView';
import WindSpeedChart from '../components/WindSpeedChart';
import RainfallChart from '../components/RainfallChart';
import OperationGuidelines from '../components/OperationGuidelines';
import { TideDateSelector } from '../components/TideDateSelector';
import { TideData } from '../utils/tideHelpers';
import { fetch24HourForecast, HourlyForecast, fetchCurrentWeather, parseWindSpeed, parseWaveHeight, testWaveHeight, fetchKaihoWindData, getLatestWindSpeed, format24HourWindData, estimateVisibility, fetchWarnings } from '../utils/weatherHelpers';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CACHE_KEY = 'weather_cache';
const CACHE_DURATION = 10 * 60 * 1000;
const TIDE_CACHE_KEY = 'tide_data_cache';
const TIDE_CACHE_DURATION = 10 * 60 * 1000;
const TIDE_API_URL = 'https://script.google.com/macros/s/AKfycbyp3Q7cMbJURDnLJuVmwX1KFQ8ho7vcu6-lVGQyLj1akfiB32-7XsXP9Lvj491W564y/exec';

// 日単位の潮汐データをメモリキャッシュ
const tideDayCache = new Map<string, any>();

interface TideDataMap {
  [key: string]: {
    tides: Array<{
      time: string;
      height: number;
      level: number;
      type: 'high' | 'low';
    }>;
  };
}

// 7日間の潮汐データを取得（キャッシュ付き）
async function fetchTideDataForMonth(year: number, month: number): Promise<TideDataMap> {
  const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

  // メモリキャッシュチェック
  if (tideDayCache.has(monthKey)) {
    console.log('[TIDE] メモリキャッシュから取得:', monthKey);
    return tideDayCache.get(monthKey);
  }

  // localStorageキャッシュチェック
  try {
    const cached = localStorage.getItem(`${TIDE_CACHE_KEY}_${monthKey}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < TIDE_CACHE_DURATION) {
        console.log('[TIDE] localStorageキャッシュから取得:', monthKey);
        tideDayCache.set(monthKey, data);
        return data;
      }
    }
  } catch (error) {
    console.log('[TIDE] キャッシュ読み取りエラー:', error);
  }

  // API呼び出し（7日間分）
  try {
    console.log('[TIDE] calc_tide API呼び出し開始（7日間）');
    const today = new Date();
    const promises = [];

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      const y = targetDate.getFullYear();
      const m = targetDate.getMonth() + 1;
      const d = targetDate.getDate();

      const url = `${TIDE_API_URL}?action=calc_tide&year=${y}&month=${m}&day=${d}`;
      console.log(`[TIDE] Day ${i + 1}/7: ${y}/${m}/${d}`);

      promises.push(
        fetch(url)
          .then(res => res.json())
          .then(data => ({
            day: d,
            date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            data: data
          }))
      );
    }

    const results = await Promise.all(promises);
    console.log('[TIDE] 全7日間のレスポンス取得完了');

    // 既存のデータ構造に変換
    const tideDataMap: TideDataMap = {};

    results.forEach((result, index) => {
      console.log(`[TIDE] Day ${index + 1} レスポンス:`, result.data);

      if (result.data.success && result.data.data) {
        const dayData = result.data.data;
        const tides = [];

        // 満潮データ
        if (dayData.flood && Array.isArray(dayData.flood)) {
          dayData.flood.forEach((f: any) => {
            tides.push({
              time: f.time,
              height: f.cm,
              level: f.cm,
              type: 'high' as const
            });
          });
        }

        // 干潮データ
        if (dayData.edd && Array.isArray(dayData.edd)) {
          dayData.edd.forEach((e: any) => {
            tides.push({
              time: e.time,
              height: e.cm,
              level: e.cm,
              type: 'low' as const
            });
          });
        }

        // 時刻順にソート
        tides.sort((a, b) => a.time.localeCompare(b.time));

        tideDataMap[result.day.toString()] = { tides };
        console.log(`[TIDE] Day ${result.day}: ${tides.length}件の潮汐データ`, tides);
      } else {
        console.warn(`[TIDE] Day ${result.day}: データ取得失敗`, result.data);
      }
    });

    console.log('[TIDE] 変換完了 - tideDataMap:', Object.keys(tideDataMap));

    // メモリキャッシュに保存
    tideDayCache.set(monthKey, tideDataMap);

    // localStorageに保存
    localStorage.setItem(
      `${TIDE_CACHE_KEY}_${monthKey}`,
      JSON.stringify({
        data: tideDataMap,
        timestamp: Date.now()
      })
    );

    return tideDataMap;

  } catch (error) {
    console.error('[TIDE] API取得エラー:', error);
    return {};
  }
}

// 特定の日付の潮汐データを取得
async function fetchTideDataForDate(date: Date): Promise<TideData> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayKey = day.toString();

  console.log('[TIDE] 日付検索:', { year, month, day, dayKey });

  const monthData = await fetchTideDataForMonth(year, month);

  if (!monthData) {
    console.warn('[TIDE] 月データなし、ダミーデータを使用');
    return {
      date: date.toISOString().split('T')[0],
      tides: [
        { time: '06:00', height: 160, type: 'high' },
        { time: '12:00', height: 50, type: 'low' },
        { time: '18:00', height: 170, type: 'high' },
        { time: '00:00', height: 40, type: 'low' }
      ]
    };
  }

  console.log('[TIDE] 利用可能なキー:', Object.keys(monthData));
  console.log('[TIDE] 検索中のキー:', dayKey);

  if (monthData[dayKey]) {
    const dayData = monthData[dayKey];
    console.log('[TIDE] データ取得成功:', dayKey, '日 -', dayData.tides?.length || 0, '件');

    if (dayData.tides && dayData.tides.length > 0) {
      return {
        date: date.toISOString().split('T')[0],
        tides: dayData.tides
      };
    }
  }

  // エラー時はダミーデータ
  console.warn('[TIDE] ' + dayKey + '日のデータなし、ダミーデータを使用');
  console.warn('[TIDE] monthDataの内容:', monthData);
  return {
    date: date.toISOString().split('T')[0],
    tides: [
      { time: '06:00', height: 160, type: 'high' },
      { time: '12:00', height: 50, type: 'low' },
      { time: '18:00', height: 170, type: 'high' },
      { time: '00:00', height: 40, type: 'low' }
    ]
  };
}

const generate24HourWindData = (currentSpeed: number) => {
  const data = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();

    const variation = (Math.random() - 0.5) * 4;
    const speed = Math.max(0, currentSpeed + variation);

    data.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      speed: Math.round(speed * 10) / 10,
      direction: '北東'
    });
  }

  return data;
};

export function Weather() {
  const [loading, setLoading] = useState(true);
  const [tideData, setTideData] = useState<TideData | null>(null);
  const [tideDataList, setTideDataList] = useState<TideData[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [currentWeather, setCurrentWeather] = useState<any>(null);
  const [kaihoData, setKaihoData] = useState<any[]>([]);
  const [realTimeWindSpeed, setRealTimeWindSpeed] = useState<number>(0);
  const [warnings, setWarnings] = useState<any[]>([]);

  useEffect(() => {
    testWaveHeight();
    loadData();
    const interval = setInterval(() => loadData(false), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (useCache = true) => {
    if (useCache) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            console.log('✅ キャッシュから即座に表示');
            setTideData(data.tideData);
            setTideDataList(data.tideDataList);
            setHourlyForecast(data.hourlyForecast);
            setCurrentWeather(data.currentWeather);

            const estimatedSpeed = parseWindSpeed(data.currentWeather.wind);
            setRealTimeWindSpeed(estimatedSpeed);

            const mockKaihoData = generate24HourWindData(estimatedSpeed);
            setKaihoData(mockKaihoData);

            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('キャッシュ読み込みエラー:', e);
        }
      }
    }

    setLoading(true);
    try {
      const [forecast, weather, warningsData] = await Promise.all([
        fetch24HourForecast(),
        fetchCurrentWeather(),
        fetchWarnings()
      ]);

      // 今日の潮汐データを取得
      const todayTide = await fetchTideDataForDate(new Date());
      console.log('[TIDE] 今日の潮汐:', todayTide);

      // 7日間の潮汐データを取得
      const weekTides: TideData[] = [];
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + i);
        const tide = await fetchTideDataForDate(targetDate);
        weekTides.push(tide);
      }
      console.log('[TIDE] 7日間の潮汐データ:', weekTides);

      setTideData(todayTide);
      setTideDataList(weekTides);
      setHourlyForecast(forecast);
      setCurrentWeather(weather);
      setWarnings(warningsData);

      const estimatedSpeed = parseWindSpeed(weather.wind);
      setRealTimeWindSpeed(estimatedSpeed);

      const mockKaihoData = generate24HourWindData(estimatedSpeed);
      setKaihoData(mockKaihoData);

      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: {
          tideData: todayTide,
          tideDataList: weekTides,
          hourlyForecast: forecast,
          currentWeather: weather
        },
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    }
    setLoading(false);
  };

  const handleBackToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowCalendar(false);
  };

  const currentWindSpeed = currentWeather ? parseWindSpeed(currentWeather.wind) : 0;
  const currentWaveHeight = currentWeather ? parseWaveHeight(currentWeather.wave) : 0;

  const pop = currentWeather?.pop ? parseInt(currentWeather.pop) : 0;
  const warningTitles = warnings.map(w => w.title || w.type || '');
  const currentVisibility = estimateVisibility(warningTitles, pop);

  const mockWeatherData = {
    forecast: [
      { date: '今日', high: 30, low: 24, condition: '晴れ', icon: '☀️' },
      { date: '明日', high: 29, low: 23, condition: '晴れ時々曇り', icon: '⛅' },
      { date: '明後日', high: 28, low: 23, condition: '曇り', icon: '☁️' },
      { date: '3日後', high: 27, low: 22, condition: '曇り時々雨', icon: '🌧️' },
      { date: '4日後', high: 28, low: 23, condition: '晴れ', icon: '☀️' },
      { date: '5日後', high: 29, low: 24, condition: '晴れ', icon: '☀️' },
      { date: '6日後', high: 30, low: 25, condition: '晴れ', icon: '☀️' }
    ]
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🌤️ 気象情報</h1>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">データ読み込み中...</span>
            </div>
          </div>
        ) : (
          <>
            <CurrentWeather />
            <WeatherAlerts />
          </>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              潮汐情報
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                カレンダー
              </button>
              <button
                onClick={handleBackToToday}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                今日に戻る
              </button>
            </div>
          </div>

          {showCalendar && (
            <div className="mb-6">
              <TideDateSelector onClose={() => setShowCalendar(false)} />
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              7日間の潮汐情報（横スクロール）
            </h3>
            {tideDataList.length > 0 ? (
              <TideScrollView tideDataList={tideDataList} selectedDate={selectedDate} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400">潮汐データを読み込み中...</p>
            )}
          </div>

          {tideData && <TideInformation tideData={tideData} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hourlyForecast.length > 0 && (
            <>
              <WindSpeedChart data={hourlyForecast} kaihoData={kaihoData} realTimeWindSpeed={realTimeWindSpeed} />
              <RainfallChart data={hourlyForecast} />
            </>
          )}
        </div>

        <OperationGuidelines
          currentWindSpeed={realTimeWindSpeed}
          currentWaveHeight={currentWaveHeight}
          currentVisibility={currentVisibility}
        />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="w-6 h-6 mr-2 text-teal-500" />
            7日間予報
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {mockWeatherData.forecast.map((day, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {day.date}
                </p>
                <div className="text-4xl mb-2">{day.icon}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {day.condition}
                </p>
                <div className="flex justify-center space-x-2 text-sm">
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {day.high}°
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {day.low}°
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            UV指数・注意事項
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 dark:text-gray-300">UV指数</span>
                <span className="font-bold text-xl text-yellow-600 dark:text-yellow-400">
                  8
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                非常に強い - 日焼け止め・帽子必須
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ・こまめな水分補給を心がけてください
                <br />
                ・長時間の直射日光は避けましょう
                <br />
                ・ライフジャケット着用を確認
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-400 text-center mt-4 pb-4">
          ※気象庁データを使用（10分ごとに更新）
        </div>
      </div>
    </Layout>
  );
}
