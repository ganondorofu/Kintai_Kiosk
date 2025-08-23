'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { handleAttendanceByCardId } from '@/lib/data-adapter';
import { createLinkRequest, watchTokenStatus, updateLinkRequestStatus } from '@/lib/data-adapter';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2, Contact } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr';
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setTempState(null);
    setMessage('NFCタグをタッチしてください');
    setSubMessage('カードリーダーにタッチするか、IDをキーボードで入力してください');
    setQrCodeUrl('');
    setRegistrationUrl('');
    setLinkRequestToken(null);
    setInputBuffer('');
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
    resetToWaiting();
    
    setCurrentTime(new Date());

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [resetToWaiting]);

  const handleAttendance = useCallback(async (cardId: string) => {
    const result = await handleAttendanceByCardId(cardId);
    if(result.status === 'unregistered') {
        showTemporaryMessage(result.message, result.subMessage || '', 'unregistered');
    } else {
        showTemporaryMessage(result.message, result.subMessage || '', result.status);
    }
  }, [showTemporaryMessage]);

  const handleRegistration = useCallback(async (cardId: string) => {
    setMode('loading_qr');
    setMessage('登録用リンクを生成中...');
    setSubMessage('しばらくお待ちください');

    try {
        const token = uuidv4();
        await createLinkRequest(token);
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost';
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
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetToWaiting();
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
        if(subMessage) setSubMessage(''); // 入力が始まったらサブメッセージをクリア
        setInputBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [inputBuffer, processInput, resetToWaiting, mode, tempState, subMessage]);
  
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    return <KioskIcon />;
  }

  const getSubMessage = () => {
    if (inputBuffer && tempState === null) return `ID: ${inputBuffer}`;
    if (subMessage) return subMessage;
    return ' ';
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-blue-50">
      <header className="p-4 flex justify-between items-center text-sm">
        <div className="font-bold text-lg text-foreground">STEM研究部 勤怠管理システム</div>
         <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs", isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{isOnline ? 'オンライン' : 'オフライン'}</span>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <Card className="w-full max-w-xl mx-auto shadow-xl">
          <CardContent className="p-8 sm:p-12 space-y-6">
            <div className="text-center mb-6">
                {currentTime ? (
                  <>
                    <div className="font-mono text-5xl font-bold text-gray-800">{currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit'})}</div>
                    <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-5xl font-bold text-gray-800 animate-pulse bg-gray-200 rounded-md w-48 mx-auto">&nbsp;</div>
                    <div className="text-sm text-muted-foreground mt-2 animate-pulse bg-gray-200 rounded-md w-64 mx-auto">&nbsp;</div>
                  </>
                )}
            </div>

            <div className="min-h-[220px] flex items-center justify-center transition-all duration-500">
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
        {(mode === 'register_prompt' || mode === 'register_qr') && <p className="text-sm p-2 bg-gray-200 rounded-md inline-block"><kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">ESC</kbd> キーで待機画面に戻ります。</p>}
      </footer>
    </div>
  );
}
