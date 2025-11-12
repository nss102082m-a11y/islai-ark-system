import React, { useState, useEffect } from 'react';
import { Lock, Calendar, Cloud, Ship, Users, FileText, Save, BarChart3, AlertCircle, Upload, CheckCircle, XCircle, Loader } from 'lucide-react';
import { collection, query, where, getDocs, getDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { parseAccountingDetailCSV, parseSalesSummaryCSV } from '../utils/csv';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

interface AutoData {
  weather: {
    loading: boolean;
    data: any | null;
    error: string | null;
  };
  boarding: {
    loading: boolean;
    data: any | null;
    error: string | null;
  };
  shift: {
    loading: boolean;
    data: any | null;
    error: string | null;
  };
}

interface ManualData {
  seaCondition: string;
  visibility: string;
  waves: string;
  currentStrength: string;
  operationStatus: string;
  cancelledTrips: number;
  cancelReason: string;
  domesticCustomers: number;
  foreignCustomers: number;
  families: number;
  couples: number;
  groups: number;
  seniors: number;
  staffing: string;
  busyPeriods: string[];
  staffMemo: string;
  incidents: string;
  complaints: string;
  compliments: string;
  notes: string;
  captainComment: string;
}

export default function DailyClosing() {
  const { currentUser } = useAuth();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autoData, setAutoData] = useState<AutoData>({
    weather: { loading: false, data: null, error: null },
    boarding: { loading: false, data: null, error: null },
    shift: { loading: false, data: null, error: null }
  });

  const [weatherData, setWeatherData] = useState<any>(null);
  const [boardingData, setBoardingData] = useState<any>(null);
  const [shiftData, setShiftData] = useState<any>(null);

  const [manualData, setManualData] = useState<ManualData>({
    seaCondition: '良好',
    visibility: '非常に良い',
    waves: '穏やか',
    currentStrength: '普通',
    operationStatus: '通常運航',
    cancelledTrips: 0,
    cancelReason: '',
    domesticCustomers: 0,
    foreignCustomers: 0,
    families: 0,
    couples: 0,
    groups: 0,
    seniors: 0,
    staffing: '適正',
    busyPeriods: [],
    staffMemo: '',
    incidents: '',
    complaints: '',
    compliments: '',
    notes: '',
    captainComment: ''
  });

  const getDayOfWeek = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        console.log('[DailyClosing] 気象情報取得開始');
        const response = await fetch(
          'https://script.google.com/macros/s/AKfycbyp3Q7cMbJURDnLJuVmwX1KFQ8ho7vcu6-lVGQyLj1akfiB32-7XsXP9Lvj491W564y/exec'
        );
        const data = await response.json();

        if (data.success && data.data.weather) {
          setWeatherData({
            temperature: data.data.weather.temperature || 0,
            windSpeed: data.data.weather.windSpeed || 0,
            windDirection: data.data.weather.windDirection || '',
            waveHeight: data.data.weather.waveHeight || 0,
            condition: data.data.weather.condition || '',
            warnings: data.data.weather.warnings || []
          });
          console.log('[DailyClosing] ✅ 気象情報取得完了');
        }
      } catch (error) {
        console.error('[DailyClosing] 気象情報の取得エラー:', error);
      }
    };

    if (selectedDate) {
      fetchWeatherData();
    }
  }, [selectedDate]);

  useEffect(() => {
    const fetchBoardingData = async () => {
      try {
        console.log('[DailyClosing] 乗船データ取得開始');
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const boardingDoc = await getDoc(doc(db, 'boarding_data', dateStr));

        if (boardingDoc.exists()) {
          const data = boardingDoc.data();

          console.log('[DEBUG] 取得したデータ:', data);

          let totalTrips = 0;
          let totalPassengers = 0;

          // data 自体が船のデータ（カジ、ムイ、ティダ）
          Object.entries(data).forEach(([boatName, boat]: [string, any]) => {
            // 'date' などのメタデータはスキップ
            if (boatName === 'date' || boatName === 'createdAt' || boatName === 'updatedAt') {
              return;
            }

            console.log(`[DEBUG] ${boatName} のデータ:`, boat);

            if (boat.trips && Array.isArray(boat.trips)) {
              console.log(`[DEBUG] ${boatName} の trips 数:`, boat.trips.length);

              boat.trips.forEach((trip: any, idx: number) => {
                console.log(`[DEBUG] ${boatName} trip[${idx}]:`, trip);

                if (trip.time) {
                  totalTrips++;
                  console.log(`[DEBUG] ✅ 便カウント: ${boatName} ${trip.time}`);

                  if (trip.entries && Array.isArray(trip.entries)) {
                    trip.entries.forEach((entry: any) => {
                      const passengers = (entry.adult || 0) + (entry.child || 0) + (entry.infant || 0);
                      console.log(`[DEBUG] entry の乗客数:`, passengers, entry);
                      totalPassengers += passengers;
                    });
                  }
                }
              });
            }
          });

          console.log('[DailyClosing] 最終集計 - 便数:', totalTrips, '乗客数:', totalPassengers);

          setBoardingData({
            totalPassengers,
            totalTrips,
            loaded: true
          });
        } else {
          console.log('[DailyClosing] ⚠️ 乗船データなし');
          setBoardingData(null);
        }
      } catch (error) {
        console.error('[DailyClosing] 乗船データの取得エラー:', error);
        setBoardingData(null);
      }
    };

    if (selectedDate) {
      fetchBoardingData();
    }
  }, [selectedDate]);

  useEffect(() => {
    const fetchShiftData = async () => {
      try {
        console.log('[DailyClosing] シフトデータ取得開始');
        const month = format(selectedDate, 'yyyy-MM');
        const shiftDoc = await getDoc(doc(db, 'shifts', month));

        if (shiftDoc.exists()) {
          const data = shiftDoc.data();
          const day = format(selectedDate, 'd');
          const staffOnDuty: string[] = [];

          if (data.schedule) {
            for (const [userId, schedule] of Object.entries(data.schedule)) {
              const daySchedule = (schedule as any)[day];
              if (daySchedule && daySchedule !== '休') {
                try {
                  const userDoc = await getDoc(doc(db, 'users', userId));
                  if (userDoc.exists()) {
                    staffOnDuty.push(userDoc.data().name);
                  }
                } catch (err) {
                  console.warn('[DailyClosing] ユーザー情報取得エラー:', userId);
                }
              }
            }
          }

          const captains = Math.min(staffOnDuty.length, 2);
          const reception = staffOnDuty.length > 2 ? Math.min(staffOnDuty.length - captains, 2) : 0;

          setShiftData({
            staffOnDuty,
            total: staffOnDuty.length,
            captains,
            reception,
            beach: staffOnDuty.length > 4 ? 1 : 0
          });
          console.log('[DailyClosing] ✅ シフトデータ取得完了:', staffOnDuty);
        } else {
          console.log('[DailyClosing] ⚠️ シフトデータなし');
          setShiftData(null);
        }
      } catch (error) {
        console.error('[DailyClosing] シフトデータの取得エラー:', error);
        setShiftData(null);
      }
    };

    if (selectedDate) {
      fetchShiftData();
    }
  }, [selectedDate]);


  const toggleBusyPeriod = (period: string) => {
    setManualData(prev => ({
      ...prev,
      busyPeriods: prev.busyPeriods.includes(period)
        ? prev.busyPeriods.filter(p => p !== period)
        : [...prev.busyPeriods, period]
    }));
  };

  const buildDailyReport = async () => {
    const reportId = format(selectedDate, 'yyyy-MM-dd');

    console.log('[BUILD] デイリーレポート構築開始');
    console.log('[BUILD] レポートID:', reportId);

    const report = {
      id: reportId,
      date: reportId,
      dayOfWeek: format(selectedDate, 'EEEE', { locale: ja }),

      sales: csvResult?.data && csvResult.data.length > 0 ? {
        total: csvResult.data.reduce((sum: number, row: any) => sum + (row.total || 0), 0),
        transactionCount: csvResult.data.reduce((sum: number, row: any) => sum + (row.transactionCount || 0), 0),
        customerCount: csvResult.data.reduce((sum: number, row: any) => sum + (row.customerCount || 0), 0),
        itemCount: csvResult.data.reduce((sum: number, row: any) => sum + (row.itemCount || 0), 0),
        dailyData: csvResult.data,
        csvFileName: csvFile?.name || '',
        csvUploadedAt: Timestamp.now()
      } : null,

      boarding: {
        totalPassengers: boardingData?.totalPassengers || 0,
        totalTrips: boardingData?.totalTrips || 0,
        loaded: boardingData?.loaded || false
      },

      staff: {
        total: shiftData?.total || 0,
        captains: shiftData?.captains || 0,
        reception: shiftData?.reception || 0,
        beach: shiftData?.beach || 0,
        staffOnDuty: shiftData?.staffOnDuty || []
      },

      weather: weatherData || null,

      actualConditions: {
        seaCondition: manualData.seaCondition || '',
        visibility: manualData.visibility || '',
        waves: manualData.waves || '',
        currentStrength: manualData.currentStrength || '',

        operationStatus: manualData.operationStatus || '',
        cancelledTrips: manualData.cancelledTrips || 0,
        cancelReason: manualData.cancelReason || '',

        customerDemographics: {
          japanese: manualData.domesticCustomers || 0,
          foreign: manualData.foreignCustomers || 0,
          families: manualData.families || 0,
          couples: manualData.couples || 0,
          groups: manualData.groups || 0,
          seniors: manualData.seniors || 0
        },

        staffing: manualData.staffing || '',
        busyPeriods: manualData.busyPeriods || [],
        staffMemo: manualData.staffMemo || '',

        incidents: manualData.incidents || '',
        complaints: manualData.complaints || '',
        compliments: manualData.compliments || '',
        notes: manualData.notes || ''
      },

      captainComment: manualData.captainComment || '',

      createdAt: Timestamp.now(),
      createdBy: currentUser?.uid || '',
      locked: true,
      version: 1
    };

    console.log('[BUILD] デイリーレポート構築完了:', report);
    return report;
  };

  const saveDailyReport = async (report: any) => {
    console.log('[FIRESTORE] 保存開始:', report.id);

    try {
      const reportRef = doc(db, 'daily_reports', report.id);
      await setDoc(reportRef, report);

      console.log('[FIRESTORE] 保存成功:', report.id);
    } catch (error) {
      console.error('[FIRESTORE] 保存エラー:', error);
      throw new Error('Firestoreへの保存に失敗しました');
    }
  };

  const uploadCSVToStorage = async () => {
    if (!csvFile) {
      console.log('[STORAGE] CSVファイルがありません');
      return null;
    }

    console.log('[STORAGE] アップロード開始:', csvFile.name);

    try {
      const fileName = `${format(selectedDate, 'yyyy-MM-dd')}_${csvFile.name}`;
      const storageRef = ref(storage, `csv_backups/accounting_detail/${fileName}`);

      await uploadBytes(storageRef, csvFile);
      console.log('[STORAGE] アップロード完了');

      const downloadURL = await getDownloadURL(storageRef);
      console.log('[STORAGE] ダウンロードURL:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('[STORAGE] アップロードエラー:', error);
      throw new Error('CSVファイルのアップロードに失敗しました');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log('[SAVE] 保存開始');

      if (!csvFile) {
        alert('CSVファイルをアップロードしてください');
        setIsSaving(false);
        return;
      }

      if (!csvResult?.data) {
        alert('CSVデータが解析されていません');
        setIsSaving(false);
        return;
      }

      console.log('[SAVE] バリデーション完了');
      console.log('[SAVE] CSVデータ:', csvResult.data);
      console.log('[SAVE] 乗船データ:', boardingData);
      console.log('[SAVE] 気象データ:', weatherData);
      console.log('[SAVE] シフトデータ:', shiftData);
      console.log('[SAVE] フォームデータ:', manualData);

      console.log('[SAVE] データ統合を開始...');
      const dailyReport = await buildDailyReport();
      console.log('[SAVE] デイリーレポート:', dailyReport);

      console.log('[SAVE] Storage保存は一時的にスキップします');
      let csvUrl = null;
      /*
      console.log('[SAVE] CSVをStorageにアップロード...');
      csvUrl = await uploadCSVToStorage();
      console.log('[SAVE] CSV URL:', csvUrl);
      */

      if (csvUrl && dailyReport.sales) {
        dailyReport.sales.csvUrl = csvUrl;
      }

      console.log('[SAVE] Firestoreに保存...');
      await saveDailyReport(dailyReport);

      setIsLocked(true);

      alert('✅ 保存完了!\n\n' +
        '- Firestoreに保存されました\n' +
        '- 編集がロックされました\n\n' +
        '※ Storage保存は後で設定します');

      console.log('[SAVE] すべての保存処理が完了しました');

    } catch (error) {
      console.error('[ERROR] 保存エラー:', error);
      alert('❌ エラー: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <div>
              <h1 className="text-2xl font-bold text-black dark:text-white">
                本日の営業を締める
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {format(selectedDate, 'yyyy-MM-dd')}（{getDayOfWeek(selectedDate)}）
              </p>
            </div>
          </div>

          {isLocked && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              <Lock className="w-5 h-5" />
              <span className="font-semibold">締め済み</span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xl font-bold text-black dark:text-white">日付選択</h2>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-800 text-black dark:text-white"
              disabled={isLocked}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {getDayOfWeek(selectedDate)}曜日
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xl font-bold text-black dark:text-white">自動取得データ</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 気象情報 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-2">
                <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-200">気象情報</h4>
              </div>
              {weatherData ? (
                <div className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                  <div className="flex items-center space-x-1">
                    <span className="text-green-600">✅</span>
                    <span className="font-medium">気象データ取得完了</span>
                  </div>
                  <div>天気: {weatherData.condition}</div>
                  <div>気温: {weatherData.temperature}°C</div>
                  <div>風速: {weatherData.windSpeed}m/s</div>
                  <div>波高: {weatherData.waveHeight}m</div>
                  {weatherData.warnings.length > 0 && (
                    <div className="text-red-600 font-medium">
                      ⚠️ {weatherData.warnings.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  読み込み中...
                </div>
              )}
            </div>

            {/* 乗船管理 */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2 mb-2">
                <Ship className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h4 className="font-semibold text-green-900 dark:text-green-200">乗船管理</h4>
              </div>
              {boardingData ? (
                <div className="text-sm space-y-1 text-green-800 dark:text-green-200">
                  <div className="flex items-center space-x-1">
                    <span className="text-green-600">✅</span>
                    <span className="font-medium">データ取得完了</span>
                  </div>
                  <div className="font-semibold text-base">
                    運航便数: {boardingData.totalTrips}便
                  </div>
                  <div className="font-semibold text-base">
                    乗船人数: {boardingData.totalPassengers}名
                  </div>
                  {boardingData.boats && (
                    <div className="text-xs mt-2 space-y-0.5">
                      {Object.entries(boardingData.boats).map(([boat, data]: [string, any]) => (
                        <div key={boat}>
                          {boat}: {data.trips}便 / {data.passengers}名
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-orange-500">
                  <div>⚠️ データなし</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    乗船管理画面でデータを入力してください
                  </div>
                </div>
              )}
            </div>

            {/* シフトデータ */}
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h4 className="font-semibold text-purple-900 dark:text-purple-200">シフトデータ</h4>
              </div>
              {shiftData ? (
                <div className="text-sm space-y-1 text-purple-800 dark:text-purple-200">
                  <div className="flex items-center space-x-1">
                    <span className="text-green-600">✅</span>
                    <span className="font-medium">シフト取得完了</span>
                  </div>
                  <div className="font-medium">
                    スタッフ配置情報利用可
                  </div>
                  <div className="text-xs mt-2 space-y-0.5">
                    <div>出勤: {shiftData.total}名</div>
                    <div>船長: {shiftData.captains}名</div>
                    <div>受付: {shiftData.reception}名</div>
                    {shiftData.beach > 0 && <div>浜: {shiftData.beach}名</div>}
                  </div>
                  {shiftData.staffOnDuty.length > 0 && (
                    <div className="text-xs mt-2 bg-white/50 dark:bg-gray-700/50 p-2 rounded">
                      {shiftData.staffOnDuty.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  読み込み中...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 relative z-10 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xl font-bold text-black dark:text-white">手動入力</h2>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-black dark:text-white mb-3">実際の海況 ⭐</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  海の状態
                </label>
                <select
                  value={manualData.seaCondition}
                  onChange={(e) => setManualData({ ...manualData, seaCondition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                >
                  <option value="良好">良好</option>
                  <option value="やや濁り">やや濁り</option>
                  <option value="濁り">濁り</option>
                  <option value="白濁">白濁</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  透明度
                </label>
                <select
                  value={manualData.visibility}
                  onChange={(e) => setManualData({ ...manualData, visibility: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                >
                  <option value="非常に良い">非常に良い</option>
                  <option value="良い">良い</option>
                  <option value="普通">普通</option>
                  <option value="悪い">悪い</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  実際の波
                </label>
                <select
                  value={manualData.waves}
                  onChange={(e) => setManualData({ ...manualData, waves: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                >
                  <option value="穏やか">穏やか</option>
                  <option value="やや高い">やや高い</option>
                  <option value="高い">高い</option>
                  <option value="非常に高い">非常に高い</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  潮流
                </label>
                <select
                  value={manualData.currentStrength}
                  onChange={(e) => setManualData({ ...manualData, currentStrength: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                >
                  <option value="弱い">弱い</option>
                  <option value="普通">普通</option>
                  <option value="強い">強い</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-black dark:text-white mb-3">運航状況</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  運航状態
                </label>
                <select
                  value={manualData.operationStatus}
                  onChange={(e) => setManualData({ ...manualData, operationStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                >
                  <option value="通常運航">通常運航</option>
                  <option value="午前のみ">午前のみ</option>
                  <option value="午後のみ">午後のみ</option>
                  <option value="一部欠航">一部欠航</option>
                  <option value="全便欠航">全便欠航</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  欠航便数
                </label>
                <input
                  type="number"
                  value={manualData.cancelledTrips}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, cancelledTrips: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  欠航理由
                </label>
                <input
                  type="text"
                  value={manualData.cancelReason}
                  onChange={(e) => setManualData({ ...manualData, cancelReason: e.target.value })}
                  placeholder="例: 強風のため"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-black dark:text-white mb-3">顧客属性（おおよその割合）</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  国内
                </label>
                <input
                  type="number"
                  value={manualData.domesticCustomers}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, domesticCustomers: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  海外
                </label>
                <input
                  type="number"
                  value={manualData.foreignCustomers}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, foreignCustomers: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  ファミリー
                </label>
                <input
                  type="number"
                  value={manualData.families}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, families: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  カップル
                </label>
                <input
                  type="number"
                  value={manualData.couples}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, couples: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  グループ
                </label>
                <input
                  type="number"
                  value={manualData.groups}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, groups: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  シニア
                </label>
                <input
                  type="number"
                  value={manualData.seniors}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setManualData({ ...manualData, seniors: value });
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-black dark:text-white mb-3">スタッフ配置評価</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-black dark:text-white mb-1">
                人員配置
              </label>
              <select
                value={manualData.staffing}
                onChange={(e) => setManualData({ ...manualData, staffing: e.target.value })}
                className="w-full md:w-1/3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white"
                disabled={isLocked}
              >
                <option value="適正">適正</option>
                <option value="やや不足">やや不足</option>
                <option value="不足">不足</option>
                <option value="過剰">過剰</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                混雑した時間帯
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'].map(period => (
                  <label key={period} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualData.busyPeriods.includes(period)}
                      onChange={() => toggleBusyPeriod(period)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      disabled={isLocked}
                    />
                    <span className="text-sm text-black dark:text-white">{period}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-1">
                スタッフメモ
              </label>
              <textarea
                value={manualData.staffMemo}
                onChange={(e) => setManualData({ ...manualData, staffMemo: e.target.value })}
                rows={3}
                placeholder="例: 午前中が特に忙しかった"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-black dark:text-white mb-3">特記事項</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  トラブル・事故
                </label>
                <textarea
                  value={manualData.incidents}
                  onChange={(e) => setManualData({ ...manualData, incidents: e.target.value })}
                  rows={2}
                  placeholder="なければ空欄"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  クレーム
                </label>
                <textarea
                  value={manualData.complaints}
                  onChange={(e) => setManualData({ ...manualData, complaints: e.target.value })}
                  rows={2}
                  placeholder="なければ空欄"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  お褒めの言葉
                </label>
                <textarea
                  value={manualData.compliments}
                  onChange={(e) => setManualData({ ...manualData, compliments: e.target.value })}
                  rows={2}
                  placeholder="なければ空欄"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  その他メモ
                </label>
                <textarea
                  value={manualData.notes}
                  onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                  rows={2}
                  placeholder="なければ空欄"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-black dark:text-white mb-3">船長総評（任意）</h3>
            <textarea
              value={manualData.captainComment}
              onChange={(e) => setManualData({ ...manualData, captainComment: e.target.value })}
              rows={4}
              placeholder="本日の総括をご記入ください（任意）"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              disabled={isLocked}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <h2 className="text-xl font-bold text-black dark:text-white">売上データ</h2>
          </div>

          <div className="space-y-4">
            {/* ファイル選択 */}
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                エアレジCSVファイル
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  console.log('[CSV] ファイル選択:', file.name);
                  setCsvFile(file);
                  setCsvParsing(true);
                  setCsvResult(null);

                  try {
                    // ヘッダー行を取得してCSV形式を判定
                    console.log('[CSV] ファイル形式を判定中...');
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const decoder = new TextDecoder('shift-jis');
                    const csvText = decoder.decode(uint8Array);
                    const lines = csvText.split(/\r?\n/);
                    const headers = lines[0].split(',');

                    console.log('[CSV] ヘッダー数:', headers.length);

                    // ヘッダー数で判定
                    if (headers.length === 14) {
                      // 売上集計CSV
                      console.log('[CSV] 売上集計CSVとして解析');
                      const salesResult = await parseSalesSummaryCSV(file);

                      if (salesResult.success && salesResult.data) {
                        console.log('[CSV] 売上集計CSV解析成功:', salesResult.data.length, '件');
                        setCsvResult({
                          success: true,
                          message: `✅ 売上集計CSV: ${salesResult.data.length}日分のデータを解析しました`,
                          data: salesResult.data
                        });
                        setCsvParsing(false);
                        return;
                      } else {
                        setCsvResult({
                          success: false,
                          message: `❌ 売上集計CSV解析エラー: ${salesResult.errors[0]?.message || '不明なエラー'}`
                        });
                      }
                    } else if (headers.length === 61) {
                      // 会計明細CSV
                      console.log('[CSV] 会計明細CSVとして解析');
                      const accountingResult = await parseAccountingDetailCSV(file);

                      if (accountingResult.success && accountingResult.data) {
                        console.log('[CSV] 会計明細CSV解析成功:', accountingResult.data.length, '件');
                        setCsvResult({
                          success: true,
                          message: `✅ 会計明細CSV: ${accountingResult.data.length}件のトランザクションを解析しました`,
                          data: accountingResult.data
                        });
                        setCsvParsing(false);
                        return;
                      } else {
                        setCsvResult({
                          success: false,
                          message: `❌ 会計明細CSV解析エラー: ${accountingResult.errors[0]?.message || '不明なエラー'}`
                        });
                      }
                    } else {
                      // 不明な形式
                      console.error('[CSV] 不明なCSV形式');
                      setCsvResult({
                        success: false,
                        message: `❌ 不明なCSV形式です。ヘッダー数: ${headers.length}\n（期待: 14列=売上集計CSV、61列=会計明細CSV）`
                      });
                    }
                  } catch (error) {
                    console.error('[CSV] 例外エラー:', error);
                    setCsvResult({
                      success: false,
                      message: `❌ エラー: ${error}`
                    });
                  } finally {
                    setCsvParsing(false);
                  }
                }}
                className="block w-full text-sm text-black dark:text-white
                           border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg cursor-pointer
                           bg-white dark:bg-gray-800
                           focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isLocked}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                会計明細CSVまたは売上集計CSVをアップロードしてください
              </p>
            </div>

            {/* 解析中 */}
            {csvParsing && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  CSV解析中...
                </span>
              </div>
            )}

            {/* 解析結果 */}
            {csvResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${
                csvResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                {csvResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    csvResult.success
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {csvResult.message}
                  </p>
                  {csvResult.success && csvResult.data && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      <p>ファイル名: {csvFile?.name}</p>
                      <p>サイズ: {((csvFile?.size || 0) / 1024).toFixed(2)} KB</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving || isLocked || !csvResult?.data}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              isSaving || isLocked || !csvResult?.data
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-teal-500 text-white hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700'
            }`}
          >
            {isSaving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                保存中...
              </>
            ) : isLocked ? (
              <>
                <Lock className="w-5 h-5" />
                保存済み
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                保存して締める
              </>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
