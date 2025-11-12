const WEATHER_API_URL = 'http://127.0.0.1:8787/api/weather/';

const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60000;

const fetchWeatherData = async () => {
  const cacheKey = WEATHER_API_URL;

  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[WEATHER] ✅ キャッシュから取得');
    return cached.data;
  }

  console.log('[WEATHER] 🌐 FastAPIから取得開始');

  try {
    const response = await fetch(WEATHER_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'データ取得に失敗しました');
    }

    requestCache.set(cacheKey, {
      data: result.data,
      timestamp: Date.now()
    });

    console.log('[WEATHER] ✅ FastAPIから取得完了');
    return result.data;
  } catch (error) {
    console.error('[WEATHER] ❌ API取得エラー:', error);

    if (cached) {
      console.warn('[WEATHER] ⚠️ 古いキャッシュを使用');
      return cached.data;
    }

    throw error;
  }
};

const WARNING_CODE_MAP: { [key: string]: string } = {
  '03': '大雨警報',
  '04': '洪水警報',
  '06': '大雪警報',
  '07': '暴風警報',
  '08': '暴風雪警報',
  '09': '波浪警報',
  '10': '高潮警報',
  '13': '大雨注意報',
  '14': '雷注意報',
  '15': '強風注意報',
  '16': '波浪注意報',
  '17': '高潮注意報',
  '18': '濃霧注意報',
  '19': '乾燥注意報',
  '20': '雪崩注意報',
  '21': 'なだれ注意報',
  '22': '着氷注意報',
  '23': '着雪注意報',
  '24': '融雪注意報',
  '25': '低温注意報',
  '26': '霜注意報',
  '32': '洪水注意報',
  '33': '風雪注意報',
  '34': '大雨警報（土砂災害）',
  '35': '大雨警報（浸水害）',
  '36': '大雪警報（降雪量）',
  '37': '大雪警報（積雪量）'
};

export const parseWarnings = (data: any) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WARNINGS] 🚨 警報・注意報パース開始');
  console.log('[WARNINGS] 生データ全体:', JSON.stringify(data, null, 2));

  try {
    if (!data || !data.areaTypes) {
      console.error('[WARNINGS] ❌ データ構造が不正:', data);
      return [];
    }

    console.log('[WARNINGS] areaTypes件数:', data.areaTypes.length);

    const alerts: any[] = [];

    data.areaTypes.forEach((areaType: any, areaTypeIndex: number) => {
      console.log(`[WARNINGS] --- areaType[${areaTypeIndex}] ---`);
      console.log(`[WARNINGS] areaType名:`, areaType.name);

      if (!areaType.areas) {
        console.log(`[WARNINGS] ⚠️ areas配列なし`);
        return;
      }

      areaType.areas.forEach((area: any, areaIndex: number) => {
        console.log(`  [WARNINGS] area[${areaIndex}]:`, area.name, 'code:', area.code);

        const isIshigaki = area.code && area.code.toString().startsWith('474');
        console.log(`  [WARNINGS] 石垣島判定:`, isIshigaki);

        if (!isIshigaki) return;

        console.log(`  [WARNINGS] ✅ 石垣島エリア発見!`);

        if (!area.warnings || !Array.isArray(area.warnings)) {
          console.log(`  [WARNINGS] ⚠️ warnings配列なし`);
          return;
        }

        console.log(`  [WARNINGS] warnings件数:`, area.warnings.length);

        area.warnings.forEach((warning: any, warningIndex: number) => {
          console.log(`    [WARNINGS] warning[${warningIndex}]:`, {
            code: warning.code,
            status: warning.status,
            name: warning.name
          });

          const code = warning.code ? warning.code.toString() : '';
          const status = warning.status || '';

          const isActive = status === '継続' || status === '発表';
          console.log(`    [WARNINGS] アクティブ判定:`, isActive, `(status="${status}")`);

          if (!isActive) {
            console.log(`    [WARNINGS] ⏭️ スキップ（status=${status}）`);
            return;
          }

          const warningName = WARNING_CODE_MAP[code] || `警報コード${code}`;
          console.log(`    [WARNINGS] コード"${code}"のマッピング結果:`, warningName);

          if (WARNING_CODE_MAP[code]) {
            console.log(`    [WARNINGS] ✅ 警報追加:`, warningName);
          } else {
            console.log(`    [WARNINGS] ⚠️ 未定義の警報コード:`, code);
          }

          alerts.push({
            title: warningName,
            level: warningName.includes('警報') ? 'warning' : 'advisory',
            description: warningName,
            status: status
          });
        });
      });
    });

    const uniqueAlerts = alerts.filter((alert, index, self) =>
      index === self.findIndex((a) => a.title === alert.title)
    );

    console.log('[WARNINGS] 重複除去前の警報数:', alerts.length);
    console.log('[WARNINGS] 重複除去後の警報数:', uniqueAlerts.length);
    console.log('[WARNINGS] 🎉 パース完了。最終結果:', uniqueAlerts);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return uniqueAlerts;
  } catch (error) {
    console.error('[WARNINGS] ❌ パースエラー:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return [];
  }
};

export const fetchCurrentWeather = async () => {
  try {
    console.log('[WEATHER] 🌐 天気データ取得開始');
    const data = await fetchWeatherData();

    console.log('[WEATHER] 📡 生データ:', data);
    console.log('[WEATHER] 📊 データ構造:', {
      isArray: Array.isArray(data),
      length: data?.length,
      hasFirstElement: !!data?.[0],
      hasTimeSeries: !!data?.[0]?.timeSeries,
      timeSeriesLength: data?.[0]?.timeSeries?.length,
      firstTimeSeriesAreas: data?.[0]?.timeSeries?.[0]?.areas?.length
    });

    if (!data || !data[0] || !data[0].timeSeries) {
      throw new Error('天気データの形式が不正です');
    }

    const timeSeries = data[0].timeSeries;

    const weatherData = timeSeries[0];
    const detailData = timeSeries[1] || {};
    const tempData = timeSeries[2] || {};

    if (!weatherData || !weatherData.areas || !weatherData.areas[0]) {
      throw new Error('天気データが見つかりません');
    }

    const area = weatherData.areas[0];
    const detailArea = detailData.areas?.[0] || {};
    const tempArea = tempData.areas?.[0] || {};

    console.log('[WEATHER] 📝 テキストデータ:');
    console.log('  天気:', area.weathers?.[0]);
    console.log('  気温:', tempArea.temps?.[0]);
    console.log('  風:', area.winds?.[0]);
    console.log('  波:', area.waves?.[0]);

    console.log('[WEATHER] 📊 詳細データ（timeSeries[1]）:');
    console.log('  風速データ:', detailArea.winds?.[0]);
    console.log('  波高データ:', detailArea.waves?.[0]);

    let windSpeed = 0;
    const windSpeedData = detailArea.winds?.[0];
    if (windSpeedData) {
      const match = windSpeedData.match(/最大風速\s*(\d+(?:\.\d+)?)\s*メートル/);
      if (match) {
        windSpeed = parseFloat(match[1]);
      }
    }

    let waveHeight = 0;
    const waveHeightData = detailArea.waves?.[0];
    if (waveHeightData) {
      const normalized = waveHeightData
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, ' ');

      const match = normalized.match(/(\d+(?:\.\d+)?)\s*メートル/);
      if (match) {
        waveHeight = parseFloat(match[1]);
      }
    }

    console.log('[WEATHER] 🔢 数値データ:');
    console.log('  風速:', windSpeed, 'm/s');
    console.log('  波高:', waveHeight, 'm');

    const result = {
      weather: area.weathers?.[0] || '情報なし',
      weatherCode: area.weatherCodes?.[0] || '100',
      temp: tempArea.temps?.[0] || '--',
      wind: area.winds?.[0] || '情報なし',
      wave: area.waves?.[0] || '情報なし',
      pop: area.pops?.[0] || '0',
      windSpeed,
      waveHeight,
    };

    console.log('[WEATHER] ✅ パース後:', result);

    return result;
  } catch (error) {
    console.error('[WEATHER] ❌ エラー:', error);

    return {
      weather: '取得できませんでした',
      weatherCode: '100',
      temp: '--',
      wind: '情報なし',
      wave: '情報なし',
      pop: '0',
      windSpeed: 0,
      waveHeight: 0,
      error: true
    };
  }
};

export const fetchWarnings = async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WARNINGS API] 📡 警報・注意報API取得開始');

  try {
    console.log('[WARNINGS API] 🌐 Apps Script経由でAPIリクエスト中...');
    const data = await fetchViaAppsScript('warnings');

    console.log('[WARNINGS API] ✅ APIレスポンス取得成功');
    console.log('[WARNINGS API] 📦 生データ:', JSON.stringify(data, null, 2));
    console.log('[WARNINGS API] レスポンスデータ型:', typeof data);
    console.log('[WARNINGS API] レスポンスがnull/undefined:', data === null || data === undefined);

    if (data) {
      console.log('[WARNINGS API] レスポンス構造:', Object.keys(data));
    }

    console.log('[WARNINGS API] parseWarnings関数に渡します');

    const parsedAlerts = parseWarnings(data);

    console.log('[WARNINGS API] 🎉 パース完了');
    console.log('[WARNINGS API] 📊 最終警報数:', parsedAlerts.length);
    console.log('[WARNINGS API] 📋 最終警報リスト:', parsedAlerts);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return parsedAlerts;
  } catch (error) {
    console.error('[WARNINGS API] ❌ API取得エラー:', error);
    console.error('[WARNINGS API] エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return [];
  }
};

export const getWeatherInfo = (weatherCode: string) => {
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

export const parseWindSpeed = (windText: string): number => {
  if (!windText || windText === '情報なし') return 0;

  const numMatch = windText.match(/(\d+)\s*メートル/);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }

  if (windText.includes('非常に強く')) return 20;
  if (windText.includes('やや強く')) return 12;
  if (windText.includes('強く')) return 15;
  if (windText.includes('やや弱く')) return 3;
  if (windText.includes('弱く')) return 2;

  return 5;
};

export const parseWaveHeight = (waveText: string): number => {
  // 入力チェック
  if (!waveText || typeof waveText !== 'string') {
    console.log('[WAVE] 入力が無効:', waveText);
    return 0;
  }

  // デバッグ：元の文字列を詳細に出力
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAVE] 元の波高テキスト:', waveText);
  console.log('[WAVE] 文字列長:', waveText.length);
  console.log('[WAVE] 文字コード詳細:');
  [...waveText].forEach((char, index) => {
    const code = char.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    console.log(`  [${index}] "${char}" → U+${hex} (${code})`);
  });

  // Step 1: 全角スペース・全角数字を半角に変換
  let normalized = waveText
    .replace(/　/g, ' ')           // 全角スペース → 半角
    .replace(/[０-９]/g, (s) => {  // 全角数字 → 半角数字
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    })
    .replace(/．/g, '.')           // 全角ピリオド → 半角（重要！）
    .replace(/\s+/g, ' ')          // 連続スペースを1つに
    .trim();                       // 前後の空白削除

  console.log('[WAVE] 正規化後:', normalized);

  // Step 2: 複数パターンでマッチング
  const patterns = [
    {
      name: '「数字＋スペース＋メートル」',
      regex: /(\d+\.?\d*)\s*メートル/,
      priority: 1
    },
    {
      name: '「数字＋メートル」（スペースなし）',
      regex: /(\d+\.?\d*)メートル/,
      priority: 2
    },
    {
      name: '「数字＋スペース＋m」',
      regex: /(\d+\.?\d*)\s*m(?![a-z])/i,
      priority: 3
    },
    {
      name: '「数字＋m」（スペースなし）',
      regex: /(\d+\.?\d*)m(?![a-z])/i,
      priority: 4
    }
  ];

  // パターンマッチングを試行
  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (match && match[1]) {
      const value = parseFloat(match[1]);

      console.log('[WAVE] ✅ マッチ成功!');
      console.log('[WAVE] パターン:', pattern.name);
      console.log('[WAVE] マッチした文字列:', match[0]);
      console.log('[WAVE] 抽出した数値文字列:', match[1]);
      console.log('[WAVE] 変換後の数値:', value);

      if (!isNaN(value) && value >= 0 && value <= 100) {
        console.log('[WAVE] 🎉 最終結果:', value, 'm');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return value;
      } else {
        console.log('[WAVE] ⚠️ 数値が範囲外:', value);
      }
    }
  }

  console.error('[WAVE] ❌ すべてのパターンでマッチ失敗');
  console.log('[WAVE] 入力テキスト:', waveText);
  console.log('[WAVE] 正規化後:', normalized);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return 0;
};

export const testWaveHeight = () => {
  console.log('\n🧪 波高パース関数のテスト開始\n');

  const testCases = [
    { input: '4メートル　うねりを伴う', expected: 4, description: '全角スペース＋うねり' },
    { input: '4メートル うねりを伴う', expected: 4, description: '半角スペース＋うねり' },
    { input: '4メートル', expected: 4, description: 'メートルのみ' },
    { input: '1.5メートル', expected: 1.5, description: '小数点あり' },
    { input: '2 メートル', expected: 2, description: 'スペース＋メートル' },
    { input: '0.5m', expected: 0.5, description: 'm表記（スペースなし）' },
    { input: '3 m', expected: 3, description: 'スペース＋m' },
    { input: '2m', expected: 2, description: 'm表記のみ' },
    { input: '5.5 m', expected: 5.5, description: '小数点＋スペース＋m' },
    { input: '４メートル　うねりを伴う', expected: 4, description: '全角数字＋全角スペース' },
    { input: '１.５メートル', expected: 1.5, description: '全角数字（小数点）' },
    { input: '２．５メートル', expected: 2.5, description: '全角数字＋全角ピリオド' },
    { input: '波が高い', expected: 0, description: '数値なし' },
    { input: '', expected: 0, description: '空文字列' },
    { input: 'うねりを伴う', expected: 0, description: '数値なし（文字のみ）' }
  ];

  let passCount = 0;
  let failCount = 0;

  testCases.forEach((test, index) => {
    console.log(`\n--- テストケース ${index + 1}/${testCases.length} ---`);
    console.log(`説明: ${test.description}`);
    console.log(`入力: "${test.input}"`);
    console.log(`期待値: ${test.expected}m`);

    const result = parseWaveHeight(test.input);
    const passed = result === test.expected;

    if (passed) {
      console.log(`✅ PASS - 結果: ${result}m`);
      passCount++;
    } else {
      console.error(`❌ FAIL - 結果: ${result}m (期待値: ${test.expected}m)`);
      failCount++;
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 テスト結果サマリー');
  console.log(`✅ 成功: ${passCount}/${testCases.length}`);
  console.log(`❌ 失敗: ${failCount}/${testCases.length}`);
  console.log(`📈 成功率: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

export const formatWindWithSpeed = (windText: string): string => {
  if (!windText || windText === '情報なし') return '情報なし';

  const windSpeed = parseWindSpeed(windText);

  if (windSpeed > 0) {
    return `${windText}（${windSpeed}m/s）`;
  }

  return windText;
};

export const fetchKaihoWindData = async () => {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=kaiho_wind`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '海保データ取得に失敗しました');
    }

    return result.data;
  } catch (error) {
    console.error('海保データ取得エラー:', error);
    return [];
  }
};

export const getLatestWindSpeed = (kaihoData: any[]): number => {
  if (!kaihoData || kaihoData.length === 0) return 0;
  return kaihoData[0].speed;
};

export const format24HourWindData = (kaihoData: any[]) => {
  return kaihoData.map(item => ({
    time: item.time.substring(0, 5),
    speed: item.speed,
    direction: item.direction
  }));
};

const estimatePrecipitationFromPop = (pop: number): number => {
  if (pop >= 80) return 20;
  if (pop >= 50) return 10;
  if (pop >= 30) return 5;
  return 0;
};

const estimateVisibilityFromRain = (precipitation: number): number => {
  if (precipitation >= 80) return 100;
  if (precipitation >= 50) return 250;
  if (precipitation >= 30) return 400;
  if (precipitation >= 20) return 750;
  if (precipitation >= 10) return 1250;
  return 2000;
};

export const estimateVisibility = (
  warnings: string[],
  precipitationProbability: number
): number => {
  console.log('[VISIBILITY] 📊 入力:', {
    warnings,
    precipitationProbability,
    hasFogWarning: warnings.includes('濃霧注意報')
  });

  let visibility = 2000;

  if (warnings.includes('濃霧注意報')) {
    visibility = Math.min(visibility, 500);
  }

  const estimatedPrecipitation = estimatePrecipitationFromPop(precipitationProbability);
  const rainVisibility = estimateVisibilityFromRain(estimatedPrecipitation);
  visibility = Math.min(visibility, rainVisibility);

  console.log('[VISIBILITY] 警報:', warnings);
  console.log('[VISIBILITY] 降水確率:', precipitationProbability, '%');
  console.log('[VISIBILITY] 推定降水量:', estimatedPrecipitation, 'mm/h');
  console.log('[VISIBILITY] ✅ 推定視程:', visibility, 'm');

  return visibility;
};

export interface HourlyForecast {
  time: string;
  temp: number;
  windSpeed: number;
  rainfall: number;
  pop: number;
}

export const fetch24HourForecast = async (): Promise<HourlyForecast[]> => {
  try {
    const data = await fetchViaAppsScript('weather');

    if (!data || !data[0] || !data[0].timeSeries) {
      throw new Error('天気データの形式が不正です');
    }

    console.log('=== 24時間予報データ取得 ===');

    const timeSeries = data[0].timeSeries;
    const hourlyData: HourlyForecast[] = [];

    const weatherTimeSeries = timeSeries[0];
    const windTimeSeries = timeSeries[1];
    const tempTimeSeries = timeSeries[2];

    console.log('気象データタイムシリーズ数:', timeSeries.length);

    if (weatherTimeSeries && weatherTimeSeries.timeDefines && weatherTimeSeries.areas) {
      const times = weatherTimeSeries.timeDefines;
      const weatherArea = weatherTimeSeries.areas[0];
      const windArea = windTimeSeries?.areas?.[0];
      const tempArea = tempTimeSeries?.areas?.[0];

      console.log('時間データ数:', times.length);

      times.forEach((time: string, index: number) => {
        const date = new Date(time);
        const hour = date.getHours();

        const windStr = windArea?.winds?.[index] || weatherArea.winds?.[index] || '';
        const windSpeed = parseWindSpeed(windStr);

        const pop = weatherArea.pops?.[index] ? parseInt(weatherArea.pops[index]) : 0;
        const rainfall = pop > 70 ? Math.random() * 5 + 2 : pop > 40 ? Math.random() * 2 : 0;

        console.log(`${hour}:00 - 風速: ${windSpeed}m/s, 降水確率: ${pop}%`);

        hourlyData.push({
          time: `${hour}:00`,
          temp: tempArea?.temps?.[index] ? parseInt(tempArea.temps[index]) : 28,
          windSpeed: windSpeed,
          rainfall: Math.round(rainfall * 10) / 10,
          pop: pop
        });
      });
    }

    console.log('取得した予報データ数:', hourlyData.length);
    return hourlyData;
  } catch (error) {
    console.error('24時間予報取得エラー:', error);
    return [];
  }
};
