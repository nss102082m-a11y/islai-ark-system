import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, Coffee, User as UserIcon } from 'lucide-react';
import { User, TimeClockEntry } from '../types';

export function TimeClock() {
  const [mode, setMode] = useState<'ipad' | 'personal'>('ipad');
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [carCommute, setCarCommute] = useState(false);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaff();
    loadRecentEntries();
  }, []);

  const loadStaff = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const data: User[] = [];

      snapshot.forEach(doc => {
        data.push(doc.data() as User);
      });

      setStaff(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const entriesRef = collection(db, 'timeClockEntries');
      const q = query(
        entriesRef,
        where('timestamp', '>=', today),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const data: any[] = [];

      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      setRecentEntries(data);
    } catch (error) {
      console.error('Error loading recent entries:', error);
    }
  };

  const handleClockAction = async (type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!selectedStaff) {
      alert('スタッフを選択してください');
      return;
    }

    try {
      const entry: Omit<TimeClockEntry, 'id'> = {
        userId: selectedStaff,
        timestamp: new Date().toISOString(),
        type,
        ...(type === 'clock_in' && carCommute && { carCommute: true })
      };

      await addDoc(collection(db, 'timeClockEntries'), entry);
      await loadRecentEntries();
      setSelectedStaff(null);
      setCarCommute(false);

      alert('打刻が完了しました');
    } catch (error) {
      console.error('Error recording time:', error);
      alert('打刻に失敗しました');
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'clock_in': return '出勤';
      case 'clock_out': return '退勤';
      case 'break_start': return '休憩開始';
      case 'break_end': return '休憩終了';
      default: return type;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'clock_in': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'clock_out': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'break_start': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'break_end': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getStaffName = (userId: string) => {
    return staff.find(s => s.uid === userId)?.name || 'Unknown';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">打刻システム</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('ipad')}
              className={`px-6 py-2 rounded-lg font-medium ${
                mode === 'ipad'
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              style={{ minHeight: '44px' }}
            >
              iPad モード
            </button>
            <button
              onClick={() => setMode('personal')}
              className={`px-6 py-2 rounded-lg font-medium ${
                mode === 'personal'
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              style={{ minHeight: '44px' }}
            >
              個人モード
            </button>
          </div>
        </div>

        {mode === 'ipad' ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                スタッフを選択
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {staff.map(member => (
                  <button
                    key={member.uid}
                    onClick={() => setSelectedStaff(member.uid)}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      selectedStaff === member.uid
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={{ minHeight: '80px' }}
                  >
                    <UserIcon className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-white text-center">
                      {member.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selectedStaff && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="mb-6">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={carCommute}
                      onChange={(e) => setCarCommute(e.target.checked)}
                      className="w-6 h-6 text-teal-500 rounded"
                    />
                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                      車通勤
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleClockAction('clock_in')}
                    className="flex flex-col items-center justify-center p-8 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    style={{ minHeight: '120px' }}
                  >
                    <LogIn className="w-12 h-12 mb-3" />
                    <span className="text-xl font-bold">出勤</span>
                  </button>

                  <button
                    onClick={() => handleClockAction('clock_out')}
                    className="flex flex-col items-center justify-center p-8 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    style={{ minHeight: '120px' }}
                  >
                    <LogOut className="w-12 h-12 mb-3" />
                    <span className="text-xl font-bold">退勤</span>
                  </button>

                  <button
                    onClick={() => handleClockAction('break_start')}
                    className="flex flex-col items-center justify-center p-8 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                    style={{ minHeight: '120px' }}
                  >
                    <Coffee className="w-12 h-12 mb-3" />
                    <span className="text-xl font-bold">休憩開始</span>
                  </button>

                  <button
                    onClick={() => handleClockAction('break_end')}
                    className="flex flex-col items-center justify-center p-8 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    style={{ minHeight: '120px' }}
                  >
                    <Clock className="w-12 h-12 mb-3" />
                    <span className="text-xl font-bold">休憩終了</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              個人モードでは、メッセージ機能から打刻リクエストを送信してください。
              <br />
              管理者の承認が必要です。
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            最近の打刻記録
          </h2>

          {recentEntries.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              打刻記録がありません
            </p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getStaffName(entry.userId)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(entry.timestamp), 'yyyy/MM/dd HH:mm:ss')}
                      {entry.carCommute && ' 🚗'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(entry.type)}`}>
                    {getActionLabel(entry.type)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
