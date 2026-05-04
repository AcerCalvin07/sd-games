'use client';

import { useEffect, useRef, useState } from 'react';
import { executeAction } from '@/services/gameService';

interface Props {
  roomId: string;
  playerId: string;
  version: number;
  category: string;
  word: string | null;
  hintTimerSeconds: number;
}

export function TurnModal({
  roomId,
  playerId,
  version,
  category,
  word,
  hintTimerSeconds,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(hintTimerSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = false;
    setSecondsLeft(hintTimerSeconds);
    setError(null);
  }, [version, hintTimerSeconds]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [version]);

  const done = async () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    const res = await executeAction(roomId, playerId, { type: 'END_TURN' }, version);
    setSubmitting(false);
    if (!res.success) {
      submittedRef.current = false;
      setError(res.error ?? 'Failed to end turn');
    }
  };

  useEffect(() => {
    if (secondsLeft === 0 && !submittedRef.current) {
      void done();
    }
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-blue-600">IT&apos;S YOUR TURN</h2>
          <span
            className={`font-mono text-lg ${
              secondsLeft <= 3 ? 'text-red-600' : 'text-zinc-500'
            }`}
          >
            {secondsLeft}s
          </span>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Say your hint out loud, then tap <span className="font-semibold">Done</span>.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-xs uppercase text-zinc-500">Category</div>
            <div className="text-base font-semibold">{category || '—'}</div>
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-xs uppercase text-zinc-500">Your word</div>
            <div className="text-base font-semibold">{word ?? '???'}</div>
          </div>
        </div>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          onClick={() => void done()}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Ending turn…' : 'Done'}
        </button>
      </div>
    </div>
  );
}
