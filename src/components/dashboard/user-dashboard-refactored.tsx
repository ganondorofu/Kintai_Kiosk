'use client';

import { AttendanceCalendar } from './attendance-calendar';
import { TodayStatsCard } from './today-stats-card';
import { UserInfoCard, AttendanceActionCard } from './user-info-card';
import { CurrentTimeDisplay } from './current-time-display';
import { useDashboard } from '@/contexts/dashboard-context';
import type { AppUser } from '@/types';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const { allUsers, isLoading } = useDashboard();

  if (isLoading) {
    return <div className="p-6">読み込み中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
        </div>
        <CurrentTimeDisplay userName={user.lastname} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AttendanceCalendar allUsers={allUsers} />
        </div>
        
        <div className="space-y-6">
          {/* 本日の状況 */}
          <TodayStatsCard />

          {/* 出勤記録アクション */}
          <AttendanceActionCard />

          {/* ユーザー情報 */}
          <UserInfoCard user={user} />
        </div>
      </div>
    </div>
  );
}
