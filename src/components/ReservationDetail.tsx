import { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Users,
  CreditCard,
  FileText,
  Globe,
  Hash,
  DollarSign
} from 'lucide-react';
import {
  Reservation,
  ReservationStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  CHANNEL_ICONS
} from '../types/reservation';
import { updateReservationStatus } from '../services/reservationService';

interface ReservationDetailProps {
  reservation: Reservation;
  onClose: () => void;
  onUpdate: () => void;
}

export function ReservationDetail({ reservation, onClose, onUpdate }: ReservationDetailProps) {
  const [selectedStatus, setSelectedStatus] = useState<ReservationStatus>(reservation.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = async () => {
    if (selectedStatus === reservation.status) return;

    setIsUpdating(true);
    try {
      const result = await updateReservationStatus(reservation.id, selectedStatus);
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        alert(`ステータス更新エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error);
      alert('ステータスの更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('この予約をキャンセルしますか？')) return;

    setIsUpdating(true);
    try {
      const result = await updateReservationStatus(reservation.id, 'cancelled');
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        alert(`キャンセルエラー: ${result.error}`);
      }
    } catch (error) {
      console.error('キャンセルエラー:', error);
      alert('キャンセルに失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const totalGuests = reservation.guests || 0;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              予約詳細
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[reservation.status]}`}>
              {STATUS_LABELS[reservation.status]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              基本情報
            </h3>

            {reservation.reservationNumber && (
              <div className="flex items-start gap-3">
                <Hash className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">予約番号</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {reservation.reservationNumber}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">販売チャネル</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{CHANNEL_ICONS[reservation.channel]}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${CHANNEL_COLORS[reservation.channel]}`}>
                    {CHANNEL_LABELS[reservation.channel]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              日時情報
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[64px]">予約日</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  {reservation.date
                    ? new Date(reservation.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short'
                      })
                    : '日付未設定'}
                </span>
              </div>

              {reservation.time && (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[64px]">時間</span>
                  <span className="text-sm text-teal-600 dark:text-teal-400 font-medium">
                    {reservation.time}
                    {reservation.endTime && ` - ${reservation.endTime}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              顧客情報
            </h3>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">顧客名</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {reservation.guestName}
                </p>
              </div>
            </div>

            {reservation.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">メール</p>
                  <a
                    href={`mailto:${reservation.email}`}
                    className="font-medium text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    {reservation.email}
                  </a>
                </div>
              </div>
            )}

            {reservation.phoneNumber && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">電話</p>
                  <a
                    href={`tel:${reservation.phoneNumber}`}
                    className="font-medium text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    {reservation.phoneNumber}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              人数情報
            </h3>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">合計人数</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {totalGuests}名
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              金額情報
            </h3>

            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">合計金額</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ¥{reservation.totalAmount.toLocaleString()}
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
                    (税込)
                  </span>
                </p>
              </div>
            </div>

            {reservation.paymentStatus && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">支払状況</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {reservation.paymentStatus === 'paid' && '支払済み'}
                    {reservation.paymentStatus === 'pending' && '未払い'}
                    {reservation.paymentStatus === 'partial' && '一部支払済み'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              その他
            </h3>

            {reservation.roomType && (
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">プラン</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {reservation.roomType}
                  </p>
                </div>
              </div>
            )}

            {reservation.specialRequests && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">特別リクエスト</p>
                  <p className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">
                    {reservation.specialRequests}
                  </p>
                </div>
              </div>
            )}

            {reservation.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">備考</p>
                  <p className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">
                    {reservation.notes}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">作成日時</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDateTime(reservation.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">更新日時</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDateTime(reservation.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              ステータス変更
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ReservationStatus)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                disabled={isUpdating}
              >
                <option value="pending">保留中</option>
                <option value="confirmed">確定</option>
                <option value="completed">完了</option>
                <option value="cancelled">キャンセル</option>
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={isUpdating || selectedStatus === reservation.status}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            disabled={isUpdating || reservation.status === 'cancelled'}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
