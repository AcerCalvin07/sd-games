'use client';

import { useEffect, useState } from 'react';
import { getRemainingSeconds } from '@/services/mister-white/timerService';

export function useCountdown(startedAtUnix: number | null, durationSeconds: number): number {
  const [remaining, setRemaining] = useState(() =>
    startedAtUnix == null ? durationSeconds : getRemainingSeconds(startedAtUnix, durationSeconds),
  );

  useEffect(() => {
    if (startedAtUnix == null) {
      setRemaining(durationSeconds);
      return;
    }
    const update = () => setRemaining(getRemainingSeconds(startedAtUnix, durationSeconds));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [startedAtUnix, durationSeconds]);

  return remaining;
}

export function timerColorClass(remaining: number, total: number): string {
  if (total <= 0) return 'text-white';
  const ratio = remaining / total;
  if (ratio < 0.25) return 'text-red-500';
  if (ratio < 0.5) return 'text-yellow-400';
  return 'text-green-400';
}
