'use client';

import { useState, useEffect, useRef } from 'react';
import { useKiosk } from '@/hooks/use-kiosk';
import { User, Search, LogIn, LogOut, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types';

export const KioskManualAttendance = () => {
    const { 
        handleManualAttendance, 
        allUsers,
        fetchUserStatus,
    } = useKiosk();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [userStatus, setUserStatus] = useState<'entry' | 'exit' | 'unknown' | 'loading'>('unknown');
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        const filtered = allUsers.filter(user =>
          (user.firstname || '').toLowerCase().includes(lowerCaseQuery) ||
          (user.lastname || '').toLowerCase().includes(lowerCaseQuery) ||
          (user.github || '').toLowerCase().includes(lowerCaseQuery)
        );
        setFilteredUsers(filtered);
        setSelectedIndex(-1);
    }, [searchQuery, allUsers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedUser) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev < filteredUsers.length - 1 ? prev + 1 : prev));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                } else if (e.key === 'Enter' && selectedIndex >= 0) {
                    e.preventDefault();
                    handleUserSelect(filteredUsers[selectedIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex, filteredUsers, selectedUser]);
    
    const handleUserSelect = async (user: AppUser) => {
        setSelectedUser(user);
        setUserStatus('loading');
        const status = await fetchUserStatus(user.uid);
        setUserStatus(status);
    };

    const renderStatusBadge = () => {
        if (userStatus === 'loading') return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />確認中</Badge>;
        if (userStatus === 'entry') return <Badge variant="default" className="bg-green-600">出勤中</Badge>;
        if (userStatus === 'exit') return <Badge variant="outline">退勤済み</Badge>;
        return null;
    };

    return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
            {!selectedUser ? (
                <>
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            type="text"
                            placeholder="名前またはGitHub IDで検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 text-lg h-12"
                        />
                    </div>
                    <ScrollArea className="h-60 w-full rounded-md border p-2">
                        {filteredUsers.map((user, index) => (
                            <div
                                key={user.uid}
                                onClick={() => handleUserSelect(user)}
                                className={cn(
                                    "p-3 rounded-md cursor-pointer flex items-center gap-3",
                                    selectedIndex === index && "bg-accent text-accent-foreground"
                                )}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <User className="h-5 w-5" />
                                <span>{user.firstname} {user.lastname} ({user.github})</span>
                            </div>
                        ))}
                    </ScrollArea>
                </>
            ) : (
                <div className="flex flex-col items-center gap-6 w-full">
                    <div className='text-center'>
                        <h3 className="text-2xl font-bold">{selectedUser.firstname} {selectedUser.lastname}</h3>
                        <div className='mt-2 h-6'>{renderStatusBadge()}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <Button onClick={() => handleManualAttendance(selectedUser, 'entry')} size="lg" className="h-20 bg-green-600 hover:bg-green-700 flex flex-col gap-2">
                            <LogIn className="w-8 h-8" /> 出勤
                        </Button>
                        <Button onClick={() => handleManualAttendance(selectedUser, 'exit')} size="lg" variant="destructive" className="h-20 flex flex-col gap-2">
                            <LogOut className="w-8 h-8" /> 退勤
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
