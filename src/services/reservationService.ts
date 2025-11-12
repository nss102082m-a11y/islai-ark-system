import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  Reservation,
  ReservationStatus,
  ReservationChannel,
  ReservationFilters,
  ReservationStats
} from '../types/reservation';

const RESERVATIONS_COLLECTION = 'reservations';
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzqfDZUbNMhoXcUpu-TBioOver8DV8Pd3ZxFXku0wS31mOJcdL6589MTMqBNMBOYdAI/exec';

const cleanReservationData = (data: any) => {
  const cleaned: any = {};

  Object.keys(data).forEach(key => {
    const value = data[key];

    if (value === undefined) {
      cleaned[key] = null;
    } else if (value === '') {
      cleaned[key] = '';
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned;
};

export async function getReservations(filters?: ReservationFilters): Promise<Reservation[]> {
  try {
    console.log('[RESERVATION] Firestoreから予約を取得開始', filters);

    const reservationsRef = collection(db, RESERVATIONS_COLLECTION);
    let q = query(reservationsRef, orderBy('date', 'desc'));

    if (filters?.status && filters.status.length > 0) {
      q = query(q, where('status', 'in', filters.status));
    }

    if (filters?.channel && filters.channel.length > 0) {
      q = query(q, where('channel', 'in', filters.channel));
    }

    const querySnapshot = await getDocs(q);
    let reservations: Reservation[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      // デバッグログ
      console.log('[RESERVATION] Firestoreから取得:', {
        id: docSnapshot.id,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        datetime: data.datetime,
        customerName: data.customerName
      });

      reservations.push({
        id: docSnapshot.id,
        guestName: data.customerName || '',
        checkIn: data.date || '',
        checkOut: data.date || '',
        nights: 1,
        guests: (data.adult || 0) + (data.child || 0) + (data.infant || 0),
        channel: data.channel || 'direct',
        status: data.status || 'pending',
        totalAmount: data.totalAmount || 0,
        phoneNumber: data.customerPhone,
        email: data.customerEmail,
        specialRequests: '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        reservationNumber: data.bookingNumber,
        paymentStatus: data.paymentMethod ? 'paid' : 'pending',
        roomType: data.planName,
        notes: '',
        // 重要: date, time, endTime フィールドを追加
        date: data.date || null,
        time: data.time || null,
        endTime: data.endTime || null
      });
    });

    if (filters?.dateFrom) {
      reservations = reservations.filter(r => r.checkIn >= filters.dateFrom!);
    }

    if (filters?.dateTo) {
      reservations = reservations.filter(r => r.checkIn <= filters.dateTo!);
    }

    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      reservations = reservations.filter(r =>
        r.guestName.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        r.phoneNumber?.includes(query) ||
        r.reservationNumber?.toLowerCase().includes(query)
      );
    }

    console.log(`[RESERVATION] ${reservations.length}件の予約を取得しました`);
    return reservations;
  } catch (error) {
    console.error('[RESERVATION] 予約取得エラー:', error);
    throw error;
  }
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  try {
    const docRef = doc(db, RESERVATIONS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      console.log('[RESERVATION] 予約詳細取得:', {
        id: docSnap.id,
        date: data.date,
        time: data.time,
        endTime: data.endTime
      });

      return {
        id: docSnap.id,
        guestName: data.customerName || '',
        checkIn: data.date || '',
        checkOut: data.date || '',
        nights: 1,
        guests: (data.adult || 0) + (data.child || 0) + (data.infant || 0),
        channel: data.channel || 'direct',
        status: data.status || 'pending',
        totalAmount: data.totalAmount || 0,
        phoneNumber: data.customerPhone,
        email: data.customerEmail,
        specialRequests: '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        reservationNumber: data.bookingNumber,
        paymentStatus: data.paymentMethod ? 'paid' : 'pending',
        roomType: data.planName,
        notes: '',
        // 重要: date, time, endTime フィールドを追加
        date: data.date || null,
        time: data.time || null,
        endTime: data.endTime || null
      };
    }

    return null;
  } catch (error) {
    console.error('[RESERVATION] 予約詳細取得エラー:', error);
    throw error;
  }
}

export async function syncReservationsFromGAS(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('[RESERVATION] Google Apps Scriptと同期開始');

    console.log('[SYNC] ステップ1: メールから新着予約を取得してスプレッドシートに保存');
    const fetchResponse = await fetch(`${GAS_API_URL}?action=fetch_reservations`);
    const fetchResult = await fetchResponse.json();

    console.log('[SYNC] メール取得結果:', fetchResult);

    console.log('[SYNC] ステップ2: スプレッドシートから全予約を取得');
    const response = await fetch(`${GAS_API_URL}?action=get_reservations`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[RESERVATION] GASレスポンス:', result);

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.error || '予約データの取得に失敗しました');
    }

    let count = 0;

    for (const reservation of result.data) {
      if (!reservation.bookingNumber) {
        console.log('[RESERVATION] 予約番号がない予約をスキップ:', reservation);
        continue;
      }

      const reservationData = cleanReservationData({
        id: reservation.bookingNumber,
        bookingNumber: reservation.bookingNumber,
        channel: reservation.channel,
        status: reservation.status,
        date: reservation.date,
        time: reservation.time,
        datetime: reservation.datetime || `${reservation.date || ''} ${reservation.time || ''}`.trim(),
        planName: reservation.planName,
        adult: reservation.adult || 0,
        child: reservation.child || 0,
        infant: reservation.infant || 0,
        totalAmount: reservation.totalAmount || 0,
        paymentMethod: reservation.paymentMethod,
        language: reservation.language,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone,
        cancelUrl: reservation.cancelUrl,
        sourceHash: reservation.sourceHash,
        dedupeKey: reservation.dedupeKey,
        createdAt: reservation.createdAt || new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      console.log('[FIRESTORE] 保存するデータ:', reservationData);

      await setDoc(
        doc(db, RESERVATIONS_COLLECTION, reservation.bookingNumber),
        reservationData
      );

      count++;
    }

    console.log(`[RESERVATION] ${count}件の予約を同期しました`);

    return { success: true, count };
  } catch (error) {
    console.error('[RESERVATION] 同期エラー:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : '同期に失敗しました'
    };
  }
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[RESERVATION] 予約ステータス更新: ${id} -> ${status}`);

    const docRef = doc(db, RESERVATIONS_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });

    console.log('[RESERVATION] ステータス更新成功');
    return { success: true };
  } catch (error) {
    console.error('[RESERVATION] ステータス更新エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ステータス更新に失敗しました'
    };
  }
}

export async function fetchNewReservationsFromEmail(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('[RESERVATION] メールから新規予約を取得開始');

    const response = await fetch(`${GAS_API_URL}?action=fetchEmailReservations`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[RESERVATION] メール取得レスポンス:', result);

    if (!result.success) {
      throw new Error(result.error || 'メールからの予約取得に失敗しました');
    }

    const newReservations = result.data || [];
    console.log(`[RESERVATION] ${newReservations.length}件の新規予約を検出`);

    if (newReservations.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    const reservationsRef = collection(db, RESERVATIONS_COLLECTION);
    let count = 0;

    for (const reservation of newReservations) {
      const newDocRef = doc(reservationsRef);
      batch.set(newDocRef, {
        ...reservation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      count++;
    }

    await batch.commit();
    console.log(`[RESERVATION] ${count}件の新規予約を追加しました`);

    return { success: true, count };
  } catch (error) {
    console.error('[RESERVATION] メール取得エラー:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'メールからの予約取得に失敗しました'
    };
  }
}

export async function createReservation(reservation: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    console.log('[RESERVATION] 新規予約を作成');

    const reservationsRef = collection(db, RESERVATIONS_COLLECTION);
    const docRef = await addDoc(reservationsRef, {
      ...reservation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('[RESERVATION] 予約作成成功:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('[RESERVATION] 予約作成エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予約の作成に失敗しました'
    };
  }
}

export async function updateReservation(
  id: string,
  updates: Partial<Omit<Reservation, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[RESERVATION] 予約を更新:', id);

    const docRef = doc(db, RESERVATIONS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    console.log('[RESERVATION] 予約更新成功');
    return { success: true };
  } catch (error) {
    console.error('[RESERVATION] 予約更新エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予約の更新に失敗しました'
    };
  }
}

export async function deleteReservation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[RESERVATION] 予約を削除:', id);

    const docRef = doc(db, RESERVATIONS_COLLECTION, id);
    await deleteDoc(docRef);

    console.log('[RESERVATION] 予約削除成功');
    return { success: true };
  } catch (error) {
    console.error('[RESERVATION] 予約削除エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予約の削除に失敗しました'
    };
  }
}

export function calculateReservationStats(reservations: Reservation[]): ReservationStats {
  const stats: ReservationStats = {
    total: reservations.length,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    completed: 0,
    totalRevenue: 0,
    averageStay: 0,
    occupancyRate: 0
  };

  if (reservations.length === 0) {
    return stats;
  }

  let totalNights = 0;

  reservations.forEach(reservation => {
    switch (reservation.status) {
      case 'confirmed':
        stats.confirmed++;
        stats.totalRevenue += reservation.totalAmount;
        break;
      case 'pending':
        stats.pending++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
      case 'completed':
        stats.completed++;
        stats.totalRevenue += reservation.totalAmount;
        break;
    }

    if (reservation.status !== 'cancelled') {
      totalNights += reservation.nights;
    }
  });

  const activeReservations = reservations.filter(r => r.status !== 'cancelled');
  stats.averageStay = activeReservations.length > 0
    ? totalNights / activeReservations.length
    : 0;

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const recentReservations = reservations.filter(r => {
    const checkIn = new Date(r.checkIn);
    return checkIn >= thirtyDaysAgo && checkIn <= today && r.status !== 'cancelled';
  });

  const totalPossibleNights = 30;
  const bookedNights = recentReservations.reduce((sum, r) => sum + r.nights, 0);
  stats.occupancyRate = (bookedNights / totalPossibleNights) * 100;

  return stats;
}
