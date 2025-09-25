
'use client';

import { useState, useEffect } from 'react';
import { Thermometer, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WbgtData {
    value: number;
    unit: string;
}

export const KioskWeather = () => {
    const [wbgt, setWbgt] = useState<WbgtData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const API_URL = 'https://stem-weather.vercel.app/api/wbgt';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                const data = await response.json();
                
                if (typeof data === 'number') {
                    setWbgt({ value: data, unit: '°C' });
                } else if (data && typeof data.value === 'number') {
                    setWbgt(data);
                } else if (data && typeof data.wbgt === 'number') {
                    setWbgt({ value: data.wbgt, unit: data.unit || '°C' });
                } else {
                     throw new Error('Invalid data format from API');
                }
                
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch WBGT data:', err);
                setError('取得失敗');
                setWbgt(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, 60000); // 1分ごとに更新

        return () => clearInterval(intervalId);
    }, []);

    const getWbgtStyle = () => {
        if (!wbgt) return 'bg-gray-100 text-gray-800';
        const value = wbgt.value;
        if (value >= 28) return 'bg-red-500 text-white'; // 厳重警戒/危険
        if (value >= 25) return 'bg-orange-500 text-white'; // 警戒
        if (value >= 21) return 'bg-yellow-400 text-gray-800'; // 注意
        return 'bg-green-500 text-white'; // ほぼ安全
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-gray-100 text-gray-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>WBGT: --.-°C</span>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-red-100 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span>WBGT: {error}</span>
            </div>
        )
    }

    return (
        <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-500", getWbgtStyle())}>
            <Thermometer className="h-4 w-4" />
            <span>WBGT: {wbgt?.value.toFixed(1)}{wbgt?.unit}</span>
        </div>
    );
};
