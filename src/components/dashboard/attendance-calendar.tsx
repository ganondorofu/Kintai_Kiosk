'use client';

import { useState } from 'react';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { DayDetail } from './day-detail';
import { useAttendanceData } from '@/hooks/use-attendance-data';
import type { AppUser } from '@/types';
import type { DayStats } from '@/hooks/use-attendance-data';

interface AttendanceCalendarProps {
  allUsers: AppUser[];
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ allUsers }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    monthlyLoading,
    fetchMonthlyData,
    fetchDayStats,
    getTotalAttendance
  } = useAttendanceData(currentDate);

  const handleNavigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    
    setSelectedDate(null);
    setDayStats([]);
    setCurrentDate(newDate);
  };

  const handleDateClick = async (date: Date) => {
    setSelectedDate(date);
    setLoading(true);
    setDayStats([]);
    
    try {
      const stats = await fetchDayStats(date);
      setDayStats(stats);
    } catch (error) {
      console.error('日別データ取得エラー:', error);
      setDayStats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateHover = (date: Date) => {
    // Preload data on hover if needed
  };

  const handleRefresh = () => {
    fetchMonthlyData(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <CalendarHeader
          currentDate={currentDate}
          monthlyLoading={monthlyLoading}
          onNavigateMonth={handleNavigateMonth}
          onRefresh={handleRefresh}
        />

        <CalendarGrid
          currentDate={currentDate}
          onDateClick={handleDateClick}
          onDateHover={handleDateHover}
          getTotalAttendance={getTotalAttendance}
          selectedDate={selectedDate}
          monthlyLoading={monthlyLoading}
        />
      </div>

      {selectedDate && (
        <DayDetail
          selectedDate={selectedDate}
          dayStats={dayStats}
          loading={loading}
        />
      )}
    </div>
  );
};
