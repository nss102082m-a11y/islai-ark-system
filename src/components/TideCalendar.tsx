import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TideCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export default function TideCalendar({ selectedDate, onDateSelect }: TideCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const isDateInRange = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const diffTime = checkDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= -3 && diffDays <= 3;
  };

  const isSelectedDate = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const inRange = isDateInRange(date);
    const selected = isSelectedDate(date);
    const today = isToday(date);

    days.push(
      <button
        key={day}
        onClick={() => inRange && onDateSelect(date)}
        disabled={!inRange}
        className={`
          aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all
          ${inRange ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-not-allowed opacity-30'}
          ${selected ? 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700' : ''}
          ${today && !selected ? 'ring-2 ring-blue-600 dark:ring-blue-400' : ''}
          ${!inRange ? 'text-gray-300 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}
        `}
      >
        {day}
      </button>
    );
  }

  const monthName = currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {monthName}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <div key={day} className="aspect-square flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        前後7日間のデータを表示できます
      </div>
    </div>
  );
}
