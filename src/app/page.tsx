'use client';

import { useState } from 'react';
import { HomeScreen } from '@/components/home/HomeScreen';
import { SplashScreen } from '@/components/splash/SplashScreen';

export default function RootPage() {
  const [done, setDone] = useState(false);
  if (!done) return <SplashScreen onDone={() => setDone(true)} />;
  return <HomeScreen />;
}
