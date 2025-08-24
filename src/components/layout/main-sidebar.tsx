'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { 
  Home, 
  Users, 
  LogOut,
  User,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function SidebarNavItem({ href, children, icon, onClose }: { href: string; children: React.ReactNode; icon: React.ReactNode, onClose?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <li>
      <Link
        href={href}
        onClick={onClose}
        className={`flex items-center p-3 rounded-lg text-base font-medium transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <span className="mr-3">{icon}</span>
        {children}
      </Link>
    </li>
  );
}

export default function MainSidebar({ onClose }: { onClose?: () => void }) {
  const { appUser, signOut } = useAuth();

  if (!appUser) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200 p-4">
        <p>Loading user...</p>
      </div>
    );
  }
  
  const getInitials = (firstname?: string, lastname?: string) => {
    if (!firstname || !lastname) return 'U';
    return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center flex-shrink-0 px-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={appUser.avatarUrl} alt={`${appUser.firstname} ${appUser.lastname}`} />
            <AvatarFallback>{getInitials(appUser.firstname, appUser.lastname)}</AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <p className="text-base font-medium text-gray-900">{appUser.firstname} {appUser.lastname}</p>
            <p className="text-sm text-gray-500">@{appUser.github}</p>
          </div>
        </div>
        
        {/* ナビゲーション */}
        <nav className="mt-8 flex-1 px-4 space-y-2">
          <ul>
            <SidebarNavItem href="/dashboard" icon={<Home className="h-5 w-5" />} onClose={onClose}>ダッシュボード</SidebarNavItem>
            {appUser.role === 'admin' && (
              <SidebarNavItem href="/dashboard/admin" icon={<ShieldCheck className="h-5 w-5" />} onClose={onClose}>管理者</SidebarNavItem>
            )}
            <SidebarNavItem href="/dashboard/teams" icon={<Users className="h-5 w-5" />} onClose={onClose}>チーム</SidebarNavItem>
            <SidebarNavItem href="/dashboard/profile" icon={<User className="h-5 w-5" />} onClose={onClose}>プロフィール</SidebarNavItem>
            <SidebarNavItem href="/dashboard/settings" icon={<Settings className="h-5 w-5" />} onClose={onClose}>設定</SidebarNavItem>
          </ul>
        </nav>
      </div>
      
      {/* フッター */}
      <div className="flex-shrink-0 flex border-t p-4">
        <Button
          onClick={signOut}
          className="w-full justify-start"
          variant="ghost"
        >
          <LogOut className="h-5 w-5 mr-3" />
          ログアウト
        </Button>
      </div>
    </div>
  );
}
