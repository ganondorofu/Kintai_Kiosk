'use client';

import { Suspense } from 'react';
import Kiosk from '@/components/kiosk/kiosk';

export default function KioskPage() {
  return (
    <Suspense>
      <Kiosk />
    </Suspense>
  );
}
