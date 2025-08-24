'use client';

import { QRCodeSVG } from 'qrcode.react';

interface KioskQrCodeProps {
    url: string;
    qrCodeDataUrl: string;
}

export const KioskQrCode = ({ url, qrCodeDataUrl }: KioskQrCodeProps) => {
    return (
        <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-lg shadow-inner">
            <QRCodeSVG value={url} size={200} className="border p-4" />
            <p className="text-sm text-muted-foreground break-all">{url}</p>
        </div>
    );
};
