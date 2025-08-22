
'use client';

import { format, eachDayOfInterval, isSameMonth, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';

interface CalendarGridProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onDateHover?: (date: Date) => void;
  getTotalAttendance: (date: Date) => number;
  selectedDate: Date | null;
  monthlyLoading: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  onDateClick,
  onDateHover,
  getTotalAttendance,
  selectedDate,
  monthlyLoading
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  //週の開始を日曜日に設定
  const startDate = startOfWeek(monthStart, { locale: ja });
  const endDate = endOfWeek(monthEnd, { locale: ja });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <>
      {/* カレンダーヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['日', '月', '火', '水', '木', '金', '土'].map(day => (
          <div key={day} className="p-2 text-center font-semibold text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);
          const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => !monthlyLoading && isCurrentMonth && onDateClick(day)}
              onMouseEnter={() => !monthlyLoading && isCurrentMonth && onDateHover?.(day)}
              className={`
                p-2 min-h-[60px] border transition-colors rounded-md
                ${!monthlyLoading && isCurrentMonth ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                ${isDayToday && isCurrentMonth ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}
                ${isSelected ? 'bg-blue-200 border-blue-400 ring-2 ring-blue-300' : ''}
                ${monthlyLoading ? 'opacity-50 animate-pulse' : ''}
              `}
            >
              <div className="font-semibold text-sm">
                {format(day, 'd')}
              </div>
              {isCurrentMonth && !monthlyLoading && getTotalAttendance(day) > 0 && (
                <div className="text-xs text-blue-600 mt-1 font-medium">
                  {getTotalAttendance(day)}人
                </div>
              )}
              {isCurrentMonth && monthlyLoading && (
                <div className="text-xs text-gray-400 mt-1">
                  ...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
