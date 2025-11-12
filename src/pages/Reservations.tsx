import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { Calendar, Filter, CheckCircle } from 'lucide-react';
import { Reservation } from '../types';

export function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, [selectedDate, statusFilter]);

  const loadReservations = async () => {
    try {
      const reservationsRef = collection(db, 'reservations');
      let q = query(reservationsRef, where('date', '==', selectedDate));

      const snapshot = await getDocs(q);
      const data: Reservation[] = [];

      snapshot.forEach(doc => {
        const reservation = { id: doc.id, ...doc.data() } as Reservation;
        if (statusFilter === 'all' || reservation.status === statusFilter) {
          data.push(reservation);
        }
      });

      setReservations(data.sort((a, b) => a.time.localeCompare(b.time)));
    } catch (error) {
      console.error('Error loading reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    try {
      const docRef = doc(db, 'reservations', reservationId);
      await updateDoc(docRef, { status: 'checked_in' });
      await loadReservations();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '保留中';
      case 'confirmed': return '確認済み';
      case 'checked_in': return 'チェックイン済み';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'checked_in': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">予約管理</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-2" />
                日付
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="inline w-4 h-4 mr-2" />
                ステータス
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                style={{ minHeight: '44px' }}
              >
                <option value="all">すべて</option>
                <option value="pending">保留中</option>
                <option value="confirmed">確認済み</option>
                <option value="checked_in">チェックイン済み</option>
              </select>
            </div>
          </div>

          {reservations.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              予約がありません
            </p>
          ) : (
            <div className="space-y-4">
              {reservations.map(reservation => (
                <div
                  key={reservation.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {reservation.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                          {getStatusLabel(reservation.status)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p>時間: {reservation.time}</p>
                        <p>
                          人数: 大人{reservation.adults}名
                          {reservation.children > 0 && ` / 子供${reservation.children}名`}
                          {reservation.infants > 0 && ` / 幼児${reservation.infants}名`}
                        </p>
                        {reservation.boat && <p>船: {reservation.boat}</p>}
                      </div>
                    </div>

                    {reservation.status === 'confirmed' && (
                      <button
                        onClick={() => handleCheckIn(reservation.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                        style={{ minHeight: '44px' }}
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span>チェックイン</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
