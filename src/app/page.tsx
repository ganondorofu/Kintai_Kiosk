'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { handleAttendanceByCardId } from '@/lib/data-adapter';
import { createLinkRequest, watchTokenStatus } from '@/lib/data-adapter';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr';
type TemporaryState = 'success' | 'error' | null;

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
    resetToWaiting(); // 初期メッセージを設定
    
    // Set current time on client side to avoid hydration mismatch
    setCurrentTime(new Date());

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [resetToWaiting]);

  const handleAttendance = useCallback(async (cardId: string) => {
    const result = await handleAttendanceByCardId(cardId);
    showTemporaryMessage(result.message, result.subMessage || '', result.status);
  }, [showTemporaryMessage]);

  const handleRegistration = useCallback(async (cardId: string) => {
    setMode('loading_qr');
    setMessage('登録用リンクを生成中...');
    setSubMessage('しばらくお待ちください');

    try {
        const token = uuidv4();
        await createLinkRequest(token);
        
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost';
  const url = `${appUrl.replace(/\/+$/, '')}/register?token=${token}&cardId=${cardId}`;
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
        setMessage('登録したいNFCタグをタッチしてください');
        setSubMessage('IDが読み取られると、登録用のQRコードが表示されます');
        setInputBuffer('');
        return;
      }
      
      if (mode === 'register_qr' || mode === 'loading_qr' || tempState !== null) return;

      if (e.key === 'Enter') {
        processInput(inputBuffer);
        setInputBuffer(''); 
      } else if (e.key.length === 1 && /^[a-z0-9]+$/i.test(e.key)) {
        setSubMessage(''); // 入力が始まったらサブメッセージをクリア
        setInputBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [inputBuffer, processInput, resetToWaiting, mode, tempState]);
  
  useEffect(() => {
    if (mode === 'register_qr' && linkRequestToken) {
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
    
    switch (mode) {
      case 'waiting':
        return <Nfc className={cn(iconClass, "text-primary animate-pulse")} />;
      case 'register_prompt':
        return <QrCode className={cn(iconClass, "text-primary")} />;
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
          <Image src={qrCodeUrl} alt="登録用QRコード" width={200} height={200} priority />
          <p className="text-sm text-muted-foreground break-all">{registrationUrl}</p>
        </div>
      );
    }
    return <KioskIcon />;
  }

  const getSubMessage = () => {
    if(subMessage) return subMessage;
    if(inputBuffer) return `ID: ${inputBuffer}`;
    return ' ';
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-br from-background to-blue-50">
      <header className="p-4 flex justify-between items-center text-sm">
        <div className="font-bold text-lg text-foreground">IT部 勤怠管理システム</div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                {currentTime ? (
                  <>
                    <div className="font-mono text-lg">{currentTime.toLocaleTimeString('ja-JP')}</div>
                    <div className="text-xs text-muted-foreground">{currentTime.toLocaleDateString('ja-JP', { weekday: 'long' })}</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-lg">--:--:--</div>
                    <div className="text-xs text-muted-foreground">--</div>
                  </>
                )}
            </div>
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs", isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{isOnline ? 'オンライン' : 'オフライン'}</span>
            </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <Card className="w-full max-w-xl mx-auto shadow-xl">
          <CardContent className="p-8 sm:p-12 space-y-6">
            <div className="min-h-[200px] flex items-center justify-center transition-all duration-500">
              {renderContent()}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground transition-all duration-500">{message}</h1>
              <p className="text-base sm:text-lg text-muted-foreground h-12">{getSubMessage()}</p>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <footer className="w-full text-center p-4 text-xs text-muted-foreground">
        {mode === 'waiting' && !tempState && <p>新しいカードを登録するには <kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">/</kbd> キーを押してください。</p>}
        {(mode === 'register_prompt' || mode === 'register_qr') && <p><kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">ESC</kbd> キーで待機画面に戻ります。</p>}
      </footer>
    </div>
  );
}
