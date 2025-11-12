import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Layout } from '../components/Layout';
import {
  ArrowLeft,
  Printer,
  DollarSign,
  ShoppingCart,
  Users,
  Ship,
  Cloud,
  AlertTriangle,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
  FileText
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyReport {
  id: string;
  date: string;
  dayOfWeek: string;
  sales: {
    total: number;
    transactionCount: number;
    customerCount: number;
    itemCount: number;
    dailyData: any[];
  } | null;
  boarding: {
    totalPassengers: number;
    totalTrips: number;
    loaded: boolean;
  };
  staff: {
    total: number;
    captains: number;
    reception: number;
    beach: number;
    staffOnDuty: string[];
  };
  weather: any;
  actualConditions: {
    seaCondition: string;
    visibility: string;
    waves: string;
    currentStrength: string;
    operationStatus: string;
    cancelledTrips: number;
    cancelReason: string;
    customerDemographics: {
      japanese: number;
      foreign: number;
      families: number;
      couples: number;
      groups: number;
      seniors: number;
    };
    staffing: string;
    busyPeriods: string[];
    staffMemo: string;
    incidents: string;
    complaints: string;
    compliments: string;
    notes: string;
  };
  captainComment: string;
  createdAt: any;
  createdBy: string;
}

export default function DailyReportDetail() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [date]);

  const loadReport = async () => {
    if (!date) return;

    try {
      setLoading(true);
      const reportRef = doc(db, 'daily_reports', date);
      const reportSnap = await getDoc(reportRef);

      if (reportSnap.exists()) {
        setReport({ id: reportSnap.id, ...reportSnap.data() } as DailyReport);
      } else {
        console.error('レポートが見つかりません');
      }
    } catch (error) {
      console.error('レポート読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!report) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">レポートが見つかりません</p>
          <button
            onClick={() => navigate('/daily-reports')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            一覧に戻る
          </button>
        </div>
      </Layout>
    );
  }

  const chartData = report.sales?.dailyData?.slice(0, 10).map((item: any, index: number) => ({
    name: `取引${index + 1}`,
    金額: item.total || 0
  })) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={() => navigate('/daily-reports')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>一覧に戻る</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="w-5 h-5" />
            <span>印刷</span>
          </button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {format(new Date(report.date), 'yyyy年M月d日', { locale: ja })}（{report.dayOfWeek}）
          </h1>
          <p className="text-gray-500 dark:text-gray-400">営業日報</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">売上</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ¥{(report.sales?.total || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">取引数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.sales?.transactionCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">客数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.sales?.customerCount || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                <Ship className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">乗船人数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.boarding?.totalPassengers || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">売上推移</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="金額" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Ship className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">乗船データ</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">総乗船人数</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.boarding?.totalPassengers || 0}人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">運航便数</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.boarding?.totalTrips || 0}便</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">スタッフ配置</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">合計</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.staff?.total || 0}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">船長</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.staff?.captains || 0}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">受付</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.staff?.reception || 0}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">ビーチ</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.staff?.beach || 0}名</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">実際の海況</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">海況</p>
              <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.seaCondition || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">視界</p>
              <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.visibility || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">波高</p>
              <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.waves || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">潮流</p>
              <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.currentStrength || '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">運航状況</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">状態</p>
              <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.operationStatus || '-'}</p>
            </div>
            {report.actualConditions?.cancelledTrips > 0 && (
              <>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">欠航便数</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">{report.actualConditions.cancelledTrips}便</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">欠航理由</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions.cancelReason}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">客層</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">国内</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.customerDemographics?.japanese || 0}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">海外</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.customerDemographics?.foreign || 0}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">ファミリー</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.customerDemographics?.families || 0}組</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">カップル</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.customerDemographics?.couples || 0}組</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">団体</span>
                <span className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.customerDemographics?.groups || 0}組</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">スタッフ稼働</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">稼働状況</p>
                <p className="font-semibold text-gray-900 dark:text-white">{report.actualConditions?.staffing || '-'}</p>
              </div>
              {report.actualConditions?.busyPeriods && report.actualConditions.busyPeriods.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">混雑時間帯</p>
                  <div className="flex flex-wrap gap-2">
                    {report.actualConditions.busyPeriods.map((period, index) => (
                      <span key={index} className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 text-sm rounded">
                        {period}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {report.actualConditions?.staffMemo && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">メモ</p>
                  <p className="text-sm text-gray-900 dark:text-white">{report.actualConditions.staffMemo}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {report.actualConditions?.incidents && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="text-lg font-bold text-red-900 dark:text-red-300">インシデント・事故</h2>
            </div>
            <p className="text-red-800 dark:text-red-300">{report.actualConditions.incidents}</p>
          </div>
        )}

        {report.actualConditions?.complaints && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsDown className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-lg font-bold text-yellow-900 dark:text-yellow-300">クレーム</h2>
            </div>
            <p className="text-yellow-800 dark:text-yellow-300">{report.actualConditions.complaints}</p>
          </div>
        )}

        {report.actualConditions?.compliments && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-green-900 dark:text-green-300">お褒めの言葉</h2>
            </div>
            <p className="text-green-800 dark:text-green-300">{report.actualConditions.compliments}</p>
          </div>
        )}

        {report.actualConditions?.notes && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-blue-900 dark:text-blue-300">特記事項</h2>
            </div>
            <p className="text-blue-800 dark:text-blue-300">{report.actualConditions.notes}</p>
          </div>
        )}

        {report.captainComment && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white p-8 rounded-lg shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Ship className="w-6 h-6" />
              <h2 className="text-xl font-bold">船長総評</h2>
            </div>
            <p className="text-lg leading-relaxed">{report.captainComment}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
