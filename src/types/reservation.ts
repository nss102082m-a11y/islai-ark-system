export type ReservationStatus = 'confirmed' | 'cancelled' | 'pending' | 'completed';
export type ReservationChannel = 'jalan' | 'rakuten' | 'airbnb' | 'direct';

export interface Reservation {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  channel: ReservationChannel;
  status: ReservationStatus;
  totalAmount: number;
  phoneNumber?: string;
  email?: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  reservationNumber?: string;
  paymentStatus?: 'paid' | 'pending' | 'partial';
  roomType?: string;
  notes?: string;
  date?: string;
  time?: string;
  endTime?: string;
}

export interface ReservationFilters {
  status?: ReservationStatus[];
  channel?: ReservationChannel[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface ReservationStats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  completed: number;
  totalRevenue: number;
  averageStay: number;
  occupancyRate: number;
}

export const STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: '確定',
  cancelled: 'キャンセル',
  pending: '保留中',
  completed: '完了'
};

export const CHANNEL_COLORS: Record<ReservationChannel, string> = {
  jalan: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  rakuten: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  airbnb: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  direct: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export const CHANNEL_LABELS: Record<ReservationChannel, string> = {
  jalan: 'じゃらん',
  rakuten: '楽天トラベル',
  airbnb: 'Airbnb',
  direct: '直接予約'
};

export const CHANNEL_ICONS: Record<ReservationChannel, string> = {
  jalan: '🏨',
  rakuten: '🏯',
  airbnb: '🏠',
  direct: '📞'
};
