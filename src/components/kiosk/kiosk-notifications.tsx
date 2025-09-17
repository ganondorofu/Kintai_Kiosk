'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, AlertCircle, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const levelConfig = {
  important: {
    icon: Megaphone,
    color: 'border-red-500/50 bg-red-50 text-red-900',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertCircle,
    color: 'border-yellow-500/50 bg-yellow-50 text-yellow-900',
    iconColor: 'text-yellow-500',
  },
  info: {
    icon: Bell,
    color: 'border-blue-500/50 bg-blue-50 text-blue-900',
    iconColor: 'text-blue-500',
  },
};

export const KioskNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(5));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(fetchedNotifications);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch notifications:', error);
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!api) {
      return
    }

    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api]);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-2">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg overflow-hidden">
        <Carousel
            setApi={setApi}
            plugins={notifications.length > 1 ? [Autoplay({ delay: 5000 })] : []}
            className="w-full"
        >
            <CarouselContent>
                {notifications.map((notification) => {
                    const config = levelConfig[notification.level] || levelConfig.info;
                    return (
                        <CarouselItem key={notification.id}>
                            <div className={cn("p-4 border-l-4", config.color)}>
                                <div className="flex items-start gap-4">
                                    <config.icon className={cn("mt-1 h-6 w-6 shrink-0", config.iconColor)} />
                                    <div className="flex-1">
                                        <p className="font-bold">{notification.title}</p>
                                        <p className="text-sm mt-1">{notification.content}</p>
                                    </div>
                                </div>
                            </div>
                        </CarouselItem>
                    );
                })}
            </CarouselContent>
        </Carousel>
        { count > 1 &&
            <div className="flex justify-center gap-2 py-2 bg-slate-100">
                {Array.from({ length: count }).map((_, i) => (
                <button
                    key={i}
                    onClick={() => api?.scrollTo(i)}
                    className={cn(
                        "h-2 w-2 rounded-full",
                        current === i + 1 ? "bg-primary" : "bg-primary/30"
                    )}
                />
                ))}
            </div>
        }
    </Card>
  );
};
