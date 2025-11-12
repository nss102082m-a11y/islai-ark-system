import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Users, FileText } from 'lucide-react';
import { Layout } from '../components/Layout';

interface DailyReport {
  id: string;
  date: string;
  dayOfWeek: string;
  sales: {
    total: number;
    transactionCount: number;
    customerCount: number;
    itemCount: number;
  } | null;
  boarding: {
    totalPassengers: number;
    totalTrips: number;
  };
  locked: boolean;
  createdAt: any;
}

export default function DailyReportsPage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    setCurrentMonth(new Date(year, month - 1, 1));
  }, [selectedMonth]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reportsRef = collection(db, 'daily_reports');
      const q = query(reportsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DailyReport[];

      setReports(reportsData);
    } catch (error) {
      console.error('レポート読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReportForDate = (date: Date): DailyReport | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reports.find(r => r.date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    const report = getReportForDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');

    if (report) {
      navigate(`/daily-reports/${dateStr}`);
    } else {
      navigate('/daily-closing');
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonth = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(year, month, 1);
    setSelectedMonth(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const monthlyStats = {
    reportCount: reports.filter(r => r.date.startsWith(format(currentMonth, 'yyyy-MM'))).length,
    totalSales: reports
      .filter(r => r.date.startsWith(format(currentMonth, 'yyyy-MM')))
      .reduce((sum, r) => sum + (r.sales?.total || 0), 0),
    totalPassengers: reports
      .filter(r => r.date.startsWith(format(currentMonth, 'yyyy-MM')))
      .reduce((sum, r) => sum + (r.boarding?.totalPassengers || 0), 0)
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">営業レポート</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="前月"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         focus:ring-2 focus:ring-teal-500 text-lg font-semibold
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="次月"
            >
              <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>

            <button
              onClick={handleToday}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg
                         transition-colors font-semibold"
            >
              今月
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">レポート数</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{monthlyStats.reportCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">月間売上</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  ¥{monthlyStats.totalSales.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">月間乗船人数</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {monthlyStats.totalPassengers.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {paddingDays.map((_, index) => (
                <div key={`padding-${index}`} className="aspect-square" />
              ))}

              {daysInMonth.map((date) => {
                const report = getReportForDate(date);
                const isToday = isSameDay(date, new Date());
                const hasReport = !!report;

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`
                      aspect-square p-2 rounded-lg border-2 transition-all
                      ${hasReport
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }
                      ${isToday ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}
                    `}
                  >
                    <div className="flex flex-col h-full">
                      <div className={`text-sm font-semibold mb-1 ${hasReport ? 'text-green-900 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {format(date, 'd')}
                      </div>

                      {hasReport && (
                        <div className="flex-1 flex flex-col justify-center text-xs">
                          <div className="text-green-700 dark:text-green-400 font-medium truncate">
                            ¥{(report.sales?.total || 0).toLocaleString()}
                          </div>
                          <div className="text-green-600 dark:text-green-500 truncate">
                            {report.boarding?.totalPassengers || 0}人
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-8 text-center text-gray-500 dark:text-gray-400">
            読み込み中...
          </div>
        )}
      </div>
    </Layout>
  );
}
