'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { TimestampDebug } from '@/components/debug/timestamp-debug';
import { AdminDashboardV2 } from './admin-dashboard-v2';

interface AdminDashboardProps {
    user: any;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'calendar' | 'debug'>('overview');

  if (!user) return null;

  const tabs = [
    { id: 'overview' as const, label: '概要' },
    { id: 'users' as const, label: 'ユーザー管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
    { id: 'debug' as const, label: 'デバッグ' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          管理者ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.firstname}さん（管理者）
        </p>
        <div className="mt-4 flex space-x-4 text-sm text-gray-500">
          <span>GitHubアカウント: {user.github}</span>
          <span className="text-purple-600 font-semibold">管理者権限</span>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <AdminDashboardV2 />}
          {activeTab === 'users' && <TeamManagement currentUser={user} />}
          {activeTab === 'calendar' && <AttendanceCalendar allUsers={[]} />}
          {activeTab === 'debug' && <TimestampDebug />}
        </div>
      </div>
    </div>
  );
}
