'use client';

import { AttendanceCalendar } from './attendance-calendar';
import { TodayStatsCard } from './today-stats-card';
import { UserInfoCard } from './user-info-card';
import { AttendanceActionCard } from './attendance-action-card';
import { CurrentTimeDisplay } from './current-time-display';
import { useDashboard } from '@/contexts/dashboard-context';
import type { AppUser } from '@/types';
import { TeamSidebar } from './team-sidebar';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const { allUsers, allTeams, isLoading } = useDashboard();

  if (isLoading) {
    return <div className="p-6">読み込み中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <p className="text-muted-foreground">ようこそ、{user.firstname}さん</p>
        </div>
        <CurrentTimeDisplay />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <TodayStatsCard />
           <AttendanceCalendar allUsers={allUsers} />
        </div>
        
        <div className="space-y-6">
          <TeamSidebar />
          <UserInfoCard user={user} allTeams={allTeams} />
          <AttendanceActionCard />
        </div>
      </div>
    </div>
  );
}
