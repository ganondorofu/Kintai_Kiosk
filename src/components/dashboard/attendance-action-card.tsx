'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export const AttendanceActionCard = () => {
    const router = useRouter();

    return (
        <Card>
            <CardHeader>
                <CardTitle>勤怠を記録する</CardTitle>
                <CardDescription>キオスク画面に移動して、NFCカードで出退勤を記録します。</CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full" onClick={() => router.push('/kiosk')}>
                    キオスク画面へ
                </Button>
            </CardContent>
        </Card>
    );
};
