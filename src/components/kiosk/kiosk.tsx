'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useKiosk } from '@/hooks/use-kiosk';
import { KioskIcon } from './kiosk-icon';
import { KioskManualAttendance } from './kiosk-manual-attendance';
import { KioskQrCode } from './kiosk-qr-code';
import { Card, CardContent } from '@/components/ui/card';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Kiosk() {
  const {
    state,
    mode,
    message,
    subMessage,
    inputBuffer,
    qrCodeUrl,
    registrationUrl,
    resetToWaiting,
    isOnline,
    handleManualModeToggle,
    handleRegistration,
  } = useKiosk();

  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getSubMessage = () => {
    if ((mode === 'waiting' || mode === 'register_prompt') && inputBuffer) {
      return `ID: ${inputBuffer}`;
    }
    return subMessage || ' ';
  };

  const renderContent = () => {
    if (mode === 'register_qr' && qrCodeUrl) {
      return (
        <KioskQrCode
          url={registrationUrl}
          qrCodeDataUrl={qrCodeUrl}
        />
      );
    }
    if (mode === 'manual_attendance') {
      return <KioskManualAttendance />;
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
        <KioskIcon mode={mode} tempState={state.tempState} />
      </div>
    );
  };

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
        {mode === 'waiting' && !state.tempState && (
          <p className="text-sm p-2 bg-gray-200 rounded-md inline-block">
            新しいカードを登録するには <kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">/</kbd> キー、手動打刻は <kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">スペース</kbd> キー
          </p>
        )}
        {(mode === 'register_prompt' || mode === 'register_qr' || mode === 'manual_attendance') && (
          <p className="text-sm p-2 bg-gray-200 rounded-md inline-block">
            <kbd className="p-1 px-2 bg-muted rounded-md text-foreground font-mono">ESC</kbd> キーで待機画面に戻ります。
          </p>
        )}
      </footer>
    </div>
  );
}
