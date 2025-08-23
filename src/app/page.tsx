
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { handleAttendanceByCardId, createLinkRequest, updateLinkRequestStatus, getAllUsers, createAttendanceLogV2 } from '@/lib/data-adapter';
import type { AppUser, LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2, Contact, User, Search, LogIn, LogOut, CircleUserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr' | 'manual_attendance';
type TemporaryState = 'success' | 'error' | 'unregistered' | null;

export default function KioskPage() {
  const [mode, setMode] = useState<KioskMode>('waiting');
  const [tempState, setTempState] = useState<TemporaryState>(null);
  const [message, setMessage] = useState('NFCタグをタッチしてください');
  const [subMessage, setSubMessage] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [linkRequestToken, setLinkRequestToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [inputBuffer, setInputBuffer] = useState('');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setTempState(null);
    setMessage('NFCタグをタッチしてください');
    setSubMessage('カードリーダーにタッチするか、IDをキーボードで入力してください');
    setQrCodeUrl('');
    setRegistrationUrl('');
    setLinkRequestToken(null);
    setInputBuffer('');
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedIndex(-1);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  
  const showTemporaryMessage = useCallback((mainMsg: string, subMsg = '', state: TemporaryState = 'success', duration = 3000) => {
    setMessage(mainMsg);
    setSubMessage(subMsg);
    setTempState(state);
    setInputBuffer('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(resetToWaiting, duration);
  }, [resetToWaiting]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    getAllUsers().then(users => {
      setAllUsers(users);
      setFilteredUsers(users);
    });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(timer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  
  useEffect(() => {
     if (mode === 'manual_attendance' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [mode]);

  const handleAttendance = useCallback(async (cardId: string) => {
    const result = await handleAttendanceByCardId(cardId);
    if(result.status === 'unregistered') {
        showTemporaryMessage(result.message, result.subMessage || '', 'unregistered');
    } else {
        showTemporaryMessage(result.message, result.subMessage || '', result.status as TemporaryState);
    }
  }, [showTemporaryMessage]);

  const handleManualAttendance = async (user: AppUser, type: 'entry' | 'exit') => {
    try {
      await createAttendanceLogV2(user.uid, type, user.cardId);
      const msg = `${user.firstname} ${user.lastname}さんの${type === 'entry' ? '出勤' : '退勤'}を記録しました。`;
      showTemporaryMessage('記録しました', msg, 'success');
    } catch (e) {
      showTemporaryMessage('エラー', '勤怠記録に失敗しました。', 'error');
    }
  }

  const handleRegistration = useCallback(async (cardId: string) => {
    setMode('loading_qr');
    setMessage('登録用リンクを生成中...');
    setSubMessage('しばらくお待ちください');

    try {
        const token = uuidv4();
        await createLinkRequest(token);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost';
        const url = `${baseUrl}/register?token=${token}&cardId=${cardId}`;
        setRegistrationUrl(url);
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`);
        setLinkRequestToken(token);
        setMode('register_qr');
        setMessage('QRコードをスキャンして登録');
        setSubMessage('スマートフォンで読み取り、表示された指示に従ってください。');

    } catch (err) {
        console.error("登録リンク生成エラー:", err);
        showTemporaryMessage('登録エラー', 'リンクを生成できませんでした。接続を確認してください。', 'error');
    }
  }, [showTemporaryMessage]);

  const processInput = useCallback((input: string) => {
    if (!isOnline) {
      showTemporaryMessage('ネットワークがオフラインです', '接続を確認してから、再度お試しください。', 'error');
      return;
    }
    const trimmedInput = input.trim();
    if (trimmedInput.length < 3) return;

    if (mode === 'waiting') {
      handleAttendance(trimmedInput);
    } else if (mode === 'register_prompt') {
      handleRegistration(trimmedInput);
    }
  }, [mode, handleAttendance, handleRegistration, showTemporaryMessage, isOnline]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetToWaiting();
        return;
      }
      
      if(tempState) return;

      if(mode === 'manual_attendance') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < filteredUsers.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          setSelectedUser(filteredUsers[selectedIndex]);
        }
        return;
      }
      
      if (mode === 'waiting' && e.key === ' ' && inputBuffer === '') {
        e.preventDefault();
        setMode('manual_attendance');
        setMessage('名前またはGitHub IDで検索');
        setSubMessage('');
        return;
      }

      if (mode === 'waiting' && e.key === '/') {
        e.preventDefault();
        setMode('register_prompt');
        setMessage('登録するカードのIDを入力してください');
        setSubMessage('IDを入力してEnterキーを押してください');
        setInputBuffer('');
        return;
      }
      
      if (mode === 'register_qr' || mode === 'loading_qr' || tempState !== null) return;

      if (e.key === 'Enter') {
        processInput(inputBuffer);
        setInputBuffer(''); 
      } else if (e.key.length === 1 && /^[a-z0-9]+$/i.test(e.key)) {
        if(subMessage) setSubMessage('');
        setInputBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputBuffer, processInput, resetToWaiting, mode, tempState, subMessage, selectedIndex, filteredUsers]);
  
  useEffect(() => {
    if (mode === 'register_qr' && linkRequestToken) {
      updateLinkRequestStatus(linkRequestToken, 'opened').catch(err => console.error(err));
      const q = query(collection(db, "link_requests"), where("token", "==", linkRequestToken), limit(1));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const data = snapshot.docs[0].data() as LinkRequest;
        if (data.status === 'done') {
            showTemporaryMessage('登録が完了しました！', 'カードを使って出退勤を記録できます。', 'success', 4000);
            unsubscribe();
        }
      });

      return () => unsubscribe();
    }
  }, [mode, linkRequestToken, showTemporaryMessage]);
  
  useEffect(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = allUsers.filter(user =>
      user.firstname.toLowerCase().includes(lowerCaseQuery) ||
      user.lastname.toLowerCase().includes(lowerCaseQuery) ||
      (user.github || '').toLowerCase().includes(lowerCaseQuery)
    );
    setFilteredUsers(filtered);
    setSelectedIndex(-1);
  }, [searchQuery, allUsers]);


  const KioskIcon = () => {
    const iconClass = "size-32 transition-all duration-500";
    if (tempState === 'success') return <CheckCircle className={cn(iconClass, "text-green-500")} />;
    if (tempState === 'error') return <XCircle className={cn(iconClass, "text-red-500")} />;
    if (tempState === 'unregistered') return <Contact className={cn(iconClass, "text-yellow-500")} />;
    
    switch (mode) {
      case 'waiting':
        return <Nfc className={cn(iconClass, "text-primary animate-pulse")} />;
      case 'register_prompt':
        return <Nfc className={cn(iconClass, "text-primary")} />;
      case 'loading_qr':
          return <Loader2 className={cn(iconClass, "text-muted-foreground animate-spin")} />;
      case 'manual_attendance':
          return <CircleUserRound className={cn(iconClass, "text-primary")} />;
      default:
        return <Nfc className={cn(iconClass, "text-primary animate-pulse")} />;
    }
  };

  const renderContent = () => {
    if (mode === 'register_qr' && qrCodeUrl) {
      return (
        <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-lg shadow-inner">
          <QRCodeSVG value={registrationUrl} size={200} className="border p-4" />
          <p className="text-sm text-muted-foreground break-all">{registrationUrl}</p>
        </div>
      );
    }
    if (mode === 'manual_attendance') {
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
                    onClick={() => setSelectedUser(user)}
                    className={cn(
                      "p-3 rounded-md cursor-pointer flex items-center gap-3",
                      selectedIndex === index && "bg-accent text-accent-foreground"
                    )}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <User className="h-5 w-5"/>
                    <span>{user.firstname} {user.lastname} ({user.github})</span>
                  </div>
                ))}
              </ScrollArea>
             </>
          ) : (
            <div className="flex flex-col items-center gap-6 w-full">
               <h3 className="text-2xl font-bold">{selectedUser.firstname} {selectedUser.lastname}</h3>
               <div className="grid grid-cols-2 gap-4 w-full">
                <Button onClick={() => handleManualAttendance(selectedUser, 'entry')} size="lg" className="h-20 bg-green-600 hover:bg-green-700 flex flex-col gap-2">
                  <LogIn className="w-8 h-8"/> 出勤
                </Button>
                <Button onClick={() => handleManualAttendance(selectedUser, 'exit')} size="lg" variant="destructive" className="h-20 flex flex-col gap-2">
                  <LogOut className="w-8 h-8"/> 退勤
                </Button>
               </div>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="text-center">
            {currentTime && (
              <>
                <div className="text-6xl font-bold font-mono tracking-wider text-gray-800">
                  {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-lg text-gray-500">
                  {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </div>
              </>
            )}
        </div>
        <KioskIcon />
      </div>
    );
  }

  const getSubMessage = () => {
    if ((mode === 'waiting' || mode === 'register_prompt') && inputBuffer) {
      return `ID: ${inputBuffer}`;
    }
    if (subMessage) return subMessage;
    return ' ';
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-blue-50">
      <header className="p-4 flex justify-between items-center text-sm">
        <div className="font-bold text-lg text-foreground">{process.env.NEXT_PUBLIC_APP_NAME || 'STEM研究部 勤怠管理システム'}</div>
         <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs", isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{isOnline ? 'オンライン' : 'オフライン'}</span>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <Card className="w-full max-w-2xl mx-auto shadow-xl transition-all duration-300">
          <CardContent className="p-8 sm:p-12 space-y-6">
            <div className="min-h-[350px] flex items-center justify-center transition-all duration-500">
              {renderContent()}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground transition-all duration-500">{message}</h1>
              <p className="text-base sm:text-lg text-muted-foreground h-12">{getSubMessage()}</p>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <footer className="w-full text-center p-4">
        {mode === 'waiting' && !tempState && <p className="text-sm p-2 bg-gray-200 rounded-md inline-block">新しいカードを登録するには <kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">/</kbd> キーを押してください。</p>}
        {(mode === 'register_prompt' || mode === 'register_qr' || mode === 'manual_attendance') && <p className="text-sm p-2 bg-gray-200 rounded-md inline-block"><kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">ESC</kbd> キーで待機画面に戻ります。</p>}
      </footer>
    </div>
  );
}
