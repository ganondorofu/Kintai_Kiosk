'use client';

import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2, Contact, User, Search, LogIn, LogOut, CircleUserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KioskMode, TemporaryState } from '@/hooks/use-kiosk';

interface KioskIconProps {
    mode: KioskMode;
    tempState: TemporaryState | null;
}

export const KioskIcon = ({ mode, tempState }: KioskIconProps) => {
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
