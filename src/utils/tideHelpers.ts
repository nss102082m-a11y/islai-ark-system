export interface Tide {
  type: 'high' | 'low';
  time: string;
  level?: number;
  height?: number;
}

export interface TideData {
  date: string;
  tides: Tide[];
}

export interface CurrentTide {
  level: number;
  isRising: boolean;
  nextTide: Tide;
  timeUntilNext: string;
}

export const parseTimeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const calculateTimeUntil = (targetTime: string): string => {
  const now = new Date();
  const [hours, minutes] = targetTime.split(':').map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0);

  let diff = target.getTime() - now.getTime();

  if (diff < 0) {
    diff += 24 * 60 * 60 * 1000;
  }

  const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
  const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hoursUntil}時間${minutesUntil}分`;
};

export const calculateCurrentTide = (tides: Tide[]): CurrentTide | null => {
  if (!tides || tides.length === 0) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sortedTides = [...tides].sort((a, b) => {
    const timeA = parseTimeToMinutes(a.time);
    const timeB = parseTimeToMinutes(b.time);
    return timeA - timeB;
  });

  let prevTide = sortedTides[sortedTides.length - 1];
  let nextTide = sortedTides[0];

  for (let i = 0; i < sortedTides.length; i++) {
    const tideMinutes = parseTimeToMinutes(sortedTides[i].time);
    if (tideMinutes <= currentMinutes) {
      prevTide = sortedTides[i];
      nextTide = sortedTides[(i + 1) % sortedTides.length];
    }
  }

  const prevMinutes = parseTimeToMinutes(prevTide.time);
  const nextMinutes = parseTimeToMinutes(nextTide.time);
  let totalDuration = nextMinutes - prevMinutes;

  if (totalDuration < 0) {
    totalDuration += 24 * 60;
  }

  let elapsed = currentMinutes - prevMinutes;
  if (elapsed < 0) {
    elapsed += 24 * 60;
  }

  const progress = elapsed / totalDuration;

  const angle = progress * Math.PI;
  const levelDiff = nextTide.level - prevTide.level;
  const currentLevel = prevTide.level + (levelDiff * (1 - Math.cos(angle)) / 2);

  const isRising = nextTide.type === 'high';

  return {
    level: Math.round(currentLevel),
    isRising,
    nextTide,
    timeUntilNext: calculateTimeUntil(nextTide.time)
  };
};

export const interpolateTideLevel = (tides: Tide[], minutes: number): number => {
  const sortedTides = [...tides].sort((a, b) => {
    const timeA = parseTimeToMinutes(a.time);
    const timeB = parseTimeToMinutes(b.time);
    return timeA - timeB;
  });

  let prevTide = sortedTides[sortedTides.length - 1];
  let nextTide = sortedTides[0];

  for (let i = 0; i < sortedTides.length; i++) {
    const tideMinutes = parseTimeToMinutes(sortedTides[i].time);
    if (tideMinutes <= minutes) {
      prevTide = sortedTides[i];
      nextTide = sortedTides[(i + 1) % sortedTides.length];
    }
  }

  const prevMinutes = parseTimeToMinutes(prevTide.time);
  const nextMinutes = parseTimeToMinutes(nextTide.time);
  let totalDuration = nextMinutes - prevMinutes;

  if (totalDuration < 0) {
    totalDuration += 24 * 60;
  }

  let elapsed = minutes - prevMinutes;
  if (elapsed < 0) {
    elapsed += 24 * 60;
  }

  const progress = elapsed / totalDuration;

  const angle = progress * Math.PI;
  const levelDiff = nextTide.level - prevTide.level;
  return prevTide.level + (levelDiff * (1 - Math.cos(angle)) / 2);
};

export const fetchTideDataForYear = async (year: number): Promise<string | null> => {
  const cacheKey = `tide_data_${year}`;
  const cacheTimeKey = `tide_data_${year}_time`;

  // キャッシュチェック（1日有効）
  const cachedTime = localStorage.getItem(cacheTimeKey);
  const cachedData = localStorage.getItem(cacheKey);

  if (cachedTime && cachedData) {
    const cacheAge = Date.now() - parseInt(cachedTime);
    if (cacheAge < 24 * 60 * 60 * 1000) {
      console.log('[潮汐] キャッシュから取得');
      return cachedData;
    }
  }

  // 新規取得
  const url = `https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/${year}/IS.txt`;
  console.log('[潮汐] データ取得:', url);

  try {
    // まず直接fetchを試す
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    // キャッシュに保存
    localStorage.setItem(cacheKey, text);
    localStorage.setItem(cacheTimeKey, Date.now().toString());

    console.log('[潮汐] データ取得成功、キャッシュに保存');
    return text;

  } catch (error) {
    console.error('[潮汐] 直接取得失敗:', error);

    // CORS エラーの場合は Apps Script 経由を試す
    try {
      const proxyUrl = `https://script.google.com/macros/s/AKfycbyp3Q7cMbJURDnLJuVmwX1KFQ8ho7vcu6-lVGQyLj1akfiB32-7XsXP9Lvj491W564y/exec?action=fetch_text&url=${encodeURIComponent(url)}`;

      const proxyResponse = await fetch(proxyUrl);
      const data = await proxyResponse.json();

      if (data.success && data.content) {
        // キャッシュに保存
        localStorage.setItem(cacheKey, data.content);
        localStorage.setItem(cacheTimeKey, Date.now().toString());

        console.log('[潮汐] Apps Script経由で取得成功');
        return data.content;
      }

      throw new Error('Apps Script failed');

    } catch (proxyError) {
      console.error('[潮汐] Apps Script経由も失敗:', proxyError);
      return null;
    }
  }
};

const fetchJMATideTextData = async (date: Date): Promise<string | null> => {
  const year = date.getFullYear();
  return fetchTideDataForYear(year);
};

export interface TideInfo {
  time: string;
  level: number;
  type: 'high' | 'low';
}

export const parseTideDataForDate = (text: string, date: Date): TideInfo[] | null => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear() % 100;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[TIDE] 検索条件: year=${year}, month=${month}, day=${day}`);

  const lines = text.split('\n');
  console.log(`[TIDE] 総行数: ${lines.length}`);
  console.log('[TIDE] 最初の5行:');
  lines.slice(0, 5).forEach((line, i) => {
    console.log(`  [${i}] ${line}`);
  });

  let targetLine: string | null = null;

  // 実際のデータフォーマットに対応
  // 例: "... 2511 3IS..." または "... 25 11  3IS..."
  const patterns = [
    new RegExp(`\\s${year}${month}\\s+${day}IS`),
    new RegExp(`\\s${year}\\s+${month}\\s+${day}IS`),
    new RegExp(`${year}${month.toString().padStart(2, ' ')}\\s+${day}IS`),
  ];

  console.log('[TIDE] 検索パターン:');
  patterns.forEach((p, i) => console.log(`  [${i}] ${p}`));

  for (const line of lines) {
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(line)) {
        targetLine = line;
        console.log(`[TIDE] ✅ マッチ成功! パターン[${i}]`);
        console.log(`[TIDE] データ行（末尾100文字）: ...${line.substring(Math.max(0, line.length - 100))}`);
        break;
      }
    }
    if (targetLine) break;
  }

  if (!targetLine) {
    console.error('[TIDE] ❌ 該当日のデータが見つかりません');
    console.warn('[TIDE] 検索した条件:', { year, month, day });

    // デバッグ: 類似した行を探す
    const similarLines = lines.filter(line =>
      line.includes(`${month} ${day}IS`) ||
      line.includes(`${month}${day}IS`) ||
      line.includes(`${year}${month} ${day}IS`) ||
      line.includes(`${year} ${month} ${day}IS`)
    );
    if (similarLines.length > 0) {
      console.warn('[TIDE] 類似した行が見つかりました:');
      similarLines.slice(0, 3).forEach((line, idx) => {
        console.warn(`[TIDE] [${idx}]`, line.substring(Math.max(0, line.length - 80)));
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  console.log('[TIDE] 📋 データ行（全体）:', targetLine);

  // ISの後ろが潮汐データ
  const match = targetLine.match(/IS(.+)/);
  if (!match) {
    console.error('[TIDE] ❌ ISマーカーが見つかりません');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  const tideStr = match[1].replace(/\s/g, '');
  console.log(`[TIDE] 潮汐データ文字列: "${tideStr}"`);
  console.log(`[TIDE] 文字列長: ${tideStr.length}`);

  const tides: TideInfo[] = [];
  let i = 0;

  // 実例に基づくパース
  // 2511 3IS507162172817111244823533199999...
  //        ↑3桁+3桁=6文字 (5:07, 162cm)
  //              ↑4桁+3桁=7文字 (17:28, 171cm)
  //                     ↑4桁+2桁=6文字 (11:24, 48cm)
  //                           ↑4桁+3桁=7文字 (23:53, 319cm ※実際は2桁31だが次のデータと繋がる）

  while (i < tideStr.length && tides.length < 8) {
    // 999999で始まる場合は終了
    if (tideStr.substring(i, i + 6) === '999999') {
      console.log('[TIDE] データ終了（999999検出）');
      break;
    }

    let timeStr = '';
    let levelStr = '';
    let consumed = 0;

    // まず次の7文字を取得
    const next7 = tideStr.substring(i, i + 7);
    const next6 = tideStr.substring(i, i + 6);

    console.log(`[TIDE] [${tides.length}] 位置${i}: 次の7文字="${next7}", 次の6文字="${next6}"`);

    // パターン判定: 4桁時刻 + 3桁潮位 = 7文字
    // 例: 1728171 → 17:28, 171cm
    if (next7.length === 7) {
      const h1 = parseInt(next7.substring(0, 2));
      const m1 = parseInt(next7.substring(2, 4));
      const l1 = parseInt(next7.substring(4, 7));

      if (h1 >= 0 && h1 <= 23 && m1 >= 0 && m1 <= 59 && !isNaN(l1)) {
        timeStr = next7.substring(0, 4);
        levelStr = next7.substring(4, 7);
        consumed = 7;
        console.log(`[TIDE]   → パターンA(4+3): time="${timeStr}" level="${levelStr}"`);
      }
    }

    // パターン判定: 3桁時刻 + 3桁潮位 = 6文字
    // 例: 507162 → 5:07, 162cm
    if (!consumed && next6.length === 6) {
      const h2 = parseInt(next6.substring(0, 1));
      const m2 = parseInt(next6.substring(1, 3));
      const l2 = parseInt(next6.substring(3, 6));

      if (h2 >= 0 && h2 <= 9 && m2 >= 0 && m2 <= 59 && !isNaN(l2)) {
        timeStr = next6.substring(0, 3);
        levelStr = next6.substring(3, 6);
        consumed = 6;
        console.log(`[TIDE]   → パターンB(3+3): time="${timeStr}" level="${levelStr}"`);
      }
    }

    // パターン判定: 4桁時刻 + 2桁潮位 = 6文字
    // 例: 112448 → 11:24, 48cm
    if (!consumed && next6.length === 6) {
      const h3 = parseInt(next6.substring(0, 2));
      const m3 = parseInt(next6.substring(2, 4));
      const l3 = parseInt(next6.substring(4, 6));

      if (h3 >= 0 && h3 <= 23 && m3 >= 0 && m3 <= 59 && !isNaN(l3) && l3 < 100) {
        timeStr = next6.substring(0, 4);
        levelStr = next6.substring(4, 6);
        consumed = 6;
        console.log(`[TIDE]   → パターンC(4+2): time="${timeStr}" level="${levelStr}"`);
      }
    }

    if (!consumed) {
      console.warn(`[TIDE] ⚠️ パース失敗 位置${i}: "${tideStr.substring(i, i + 10)}"`);
      i++;
      continue;
    }

    const hour = parseInt(timeStr.substring(0, timeStr.length - 2));
    const minute = parseInt(timeStr.substring(timeStr.length - 2));
    const level = parseInt(levelStr);

    if (isNaN(hour) || isNaN(minute) || isNaN(level)) {
      console.warn('[TIDE] ⚠️ 不正なデータ:', { timeStr, levelStr, hour, minute, level });
      i += consumed;
      continue;
    }

    // 満潮 or 干潮の判定（潮位で判断）
    const type: 'high' | 'low' = level >= 100 ? 'high' : 'low';

    const tideInfo = {
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      level: level,
      type: type
    };

    console.log(`[TIDE]   ✅ ${type === 'high' ? '満潮' : '干潮'}: ${tideInfo.time} ${tideInfo.level}cm`);

    tides.push(tideInfo);
    i += consumed;
  }

  console.log('[TIDE] 🎉 パース完了:', tides);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return tides;
};

const parseJMATideText = (text: string, date: Date): Tide[] | null => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear() % 100;

  console.log('[TIDE] パース対象:', { year, month, day });

  const lines = text.split('\n');
  const targetLine = lines.find(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)IS/);
    if (!match) return false;

    const lineYear = parseInt(match[1]);
    const lineMonth = parseInt(match[2]);
    const lineDay = parseInt(match[3]);

    return lineYear === year && lineMonth === month && lineDay === day;
  });

  if (!targetLine) {
    console.warn('[TIDE] 該当日のデータが見つかりません');
    return null;
  }

  console.log('[TIDE] 該当行:', targetLine);

  const tideMatch = targetLine.match(/IS(.+)/);
  if (!tideMatch) {
    console.warn('[TIDE] 潮汐データ部分が見つかりません');
    return null;
  }

  const tideData = tideMatch[1].trim().replace(/\s+/g, '');
  console.log('[TIDE] 潮汐データ:', tideData);

  const tides: Tide[] = [];
  let isHigh = true;

  for (let i = 0; i < tideData.length; i += 7) {
    const timeStr = tideData.substr(i, 4);
    const levelStr = tideData.substr(i + 4, 3);

    if (timeStr === '9999' || !timeStr || timeStr.length < 4) break;

    const hour = parseInt(timeStr.substr(0, 2));
    const minute = parseInt(timeStr.substr(2, 2));
    const level = parseInt(levelStr);

    if (isNaN(hour) || isNaN(minute) || isNaN(level)) {
      console.warn('[TIDE] 不正なデータ:', { timeStr, levelStr });
      continue;
    }

    tides.push({
      type: isHigh ? 'high' : 'low',
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      level: level
    });

    isHigh = !isHigh;
  }

  console.log('[TIDE] パース成功:', tides);
  return tides;
};

export const fetchTideData = async (dateOffset: number = 0): Promise<TideData> => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dateOffset);

  console.log('[TIDE] Fetching tide data for:', targetDate.toISOString());

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();

  try {
    const textData = await fetchJMATideTextData(targetDate);
    if (textData) {
      const tidesFromText = parseJMATideText(textData, targetDate);
      if (tidesFromText && tidesFromText.length > 0) {
        console.log('[TIDE] 気象庁テキストデータ使用');
        return {
          date: targetDate.toISOString().split('T')[0],
          tides: tidesFromText
        };
      }
    }

    console.log('[TIDE] フォールバック: API経由で取得');
    const apiUrl = `https://script.google.com/macros/s/AKfycbyp3Q7cMbJURDnLJuVmwX1KFQ8ho7vcu6-lVGQyLj1akfiB32-7XsXP9Lvj491W564y/exec?action=tide_data&yr=${year}&mn=${month}&dy=${day}&rg=day`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[TIDE] API Response:', result);

    if (!result.success || !result.data) {
      throw new Error('API returned error');
    }

    const data = result.data;

    if (data.status !== 1) {
      throw new Error('Tide API returned error status');
    }

    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = data.tide.chart[dateKey];

    if (!dayData) {
      throw new Error('No data for requested date');
    }

    const tides: Tide[] = [];

    if (dayData.edd) {
      dayData.edd.forEach((edd: any) => {
        tides.push({
          type: 'low',
          time: edd.time,
          level: Math.round(edd.cm)
        });
      });
    }

    if (dayData.flood) {
      dayData.flood.forEach((flood: any) => {
        tides.push({
          type: 'high',
          time: flood.time,
          level: Math.round(flood.cm)
        });
      });
    }

    tides.sort((a, b) => {
      const timeA = parseTimeToMinutes(a.time);
      const timeB = parseTimeToMinutes(b.time);
      return timeA - timeB;
    });

    console.log('[TIDE] Successfully parsed tide data:', { tides });

    return {
      date: targetDate.toISOString().split('T')[0],
      tides
    };

  } catch (error) {
    console.error('[TIDE] Error fetching tide data:', error);

    const dateStr = targetDate.toISOString().split('T')[0];
    return {
      date: dateStr,
      tides: [
        { type: 'low', time: '01:20', level: 70 },
        { type: 'high', time: '06:30', level: 180 },
        { type: 'low', time: '12:45', level: 65 },
        { type: 'high', time: '19:15', level: 175 }
      ]
    };
  }
};

export const fetch7DayTideData = async (): Promise<TideData[]> => {
  const promises = [];
  for (let i = 0; i < 7; i++) {
    promises.push(fetchTideData(i));
  }
  return Promise.all(promises);
};

export interface WeatherAlert {
  level: 'warning' | 'advisory' | 'info';
  title: string;
  description: string;
  status?: string;
  time?: string;
}

export interface CurrentWeather {
  weather: string;
  weatherCode: string;
  temp: string;
  wind: string;
  wave: string;
  pop: string;
}

export interface WeatherInfo {
  icon: string;
  status: string;
  color: string;
}

const WEATHER_API = {
  forecast: 'https://www.jma.go.jp/bosai/forecast/data/forecast/474000.json',
  warnings: 'https://www.jma.go.jp/bosai/warning/data/warning/474000.json',
  overview: 'https://www.jma.go.jp/bosai/forecast/data/overview_forecast/474000.json',
};

export const parseWarnings = (data: any): WeatherAlert[] => {
  if (!data || !data.areaTypes) return [];

  const alerts: WeatherAlert[] = [];

  data.areaTypes.forEach((areaType: any) => {
    areaType.areas.forEach((area: any) => {
      if (area.name === '石垣島地方' || area.name === '八重山地方') {
        area.warnings.forEach((warning: any) => {
          if (warning.status !== '解除') {
            alerts.push({
              title: warning.name,
              level: warning.name.includes('警報') ? 'warning' : 'advisory',
              description: warning.name,
              status: warning.status
            });
          }
        });
      }
    });
  });

  return alerts;
};

export const fetchCurrentWeather = async (): Promise<CurrentWeather | null> => {
  try {
    const response = await fetch(WEATHER_API.forecast);
    const data = await response.json();

    const timeSeries = data[0]?.timeSeries;
    if (!timeSeries) return null;

    const weatherData = timeSeries[0];
    const windData = timeSeries[1];
    const waveData = timeSeries[2];

    const currentIndex = 0;

    return {
      weather: weatherData.areas[0].weathers[currentIndex],
      weatherCode: weatherData.areas[0].weatherCodes[currentIndex],
      temp: weatherData.areas[0].temps?.[currentIndex] || '28',
      wind: windData.areas[0].winds[currentIndex],
      wave: waveData.areas[0].waves[currentIndex],
      pop: weatherData.areas[0].pops?.[currentIndex] || '0',
    };
  } catch (error) {
    console.error('天気情報取得エラー:', error);
    return null;
  }
};

export const getWeatherInfo = (weatherCode: string): WeatherInfo => {
  const code = parseInt(weatherCode);

  if (code >= 100 && code < 200) {
    return {
      icon: '☀️',
      status: '晴れ',
      color: 'from-yellow-500 to-orange-500'
    };
  } else if (code >= 200 && code < 300) {
    return {
      icon: '☁️',
      status: '曇り',
      color: 'from-gray-500 to-gray-600'
    };
  } else if (code >= 300 && code < 500) {
    return {
      icon: '🌧️',
      status: '雨',
      color: 'from-blue-600 to-blue-700'
    };
  } else {
    return {
      icon: '🌤️',
      status: '薄曇り',
      color: 'from-blue-400 to-blue-500'
    };
  }
};

export const fetchWeatherData = async () => {
  try {
    const tideData = await fetchTideData();

    return {
      forecastData: null,
      warningsData: null,
      tideData
    };
  } catch (error) {
    console.error('気象情報取得エラー:', error);
    return null;
  }
};

export const fetchWarnings = async () => {
  try {
    const response = await fetch(WEATHER_API.warnings);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('警報取得エラー:', error);
    return null;
  }
};
