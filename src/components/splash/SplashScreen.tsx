'use client';

import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
  durationMs?: number;
}

export function SplashScreen({ onDone, durationMs = 2000 }: SplashScreenProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fadeIn = setTimeout(() => setShow(true), 500);
    const finish = setTimeout(onDone, durationMs);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(finish);
    };
  }, [onDone, durationMs]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <div
        className={`flex flex-col items-center gap-3 transition-opacity duration-700 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="text-6xl" aria-hidden>
          🎮
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">SD Games</h1>
        <p className="text-sm text-zinc-400">Multiplayer party games</p>
      </div>
    </div>
  );
}
