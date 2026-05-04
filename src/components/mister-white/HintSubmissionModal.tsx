'use client';

import { useEffect, useRef, useState } from 'react';
import { executeAction } from '@/services/gameService';
import { HINT_TIMER_SECONDS, MAX_HINT_LEN } from '@/utils/constants';
import { isValidHint } from '@/utils/validation';

interface Props {
  roomId: string;
  playerId: string;
  version: number;
  category: string;
  word: string | null;
}

export function HintSubmissionModal({ roomId, playerId, version, category, word }: Props) {
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HINT_TIMER_SECONDS);
  const submittedRef = useRef(false);

  useEffect(() => {
    submittedRef.current = false;
    setHint('');
    setError(null);
    setSecondsLeft(HINT_TIMER_SECONDS);
  }, [roomId, version]);

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [version]);

  const submit = async (value: string) => {
    if (submittedRef.current || submitting) return;
    if (!isValidHint(value)) {
      setError('Hint must be 1–50 letters, numbers, or spaces.');
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    const res = await executeAction(
      roomId,
      playerId,
      { type: 'SUBMIT_HINT', payload: { hint: value.trim() } },
      version,
    );
    setSubmitting(false);
    if (!res.success) {
      submittedRef.current = false;
      setError(res.error ?? 'Failed to submit');
    }
  };

  useEffect(() => {
    if (secondsLeft === 0 && !submittedRef.current) {
      void submit(hint || 'pass');
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

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-xs uppercase text-zinc-500">Category</div>
            <div className="font-semibold">{category || '—'}</div>
          </div>
          <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-xs uppercase text-zinc-500">Your word</div>
            <div className="font-semibold">{word ?? '???'}</div>
          </div>
        </div>

        <input
          autoFocus
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={MAX_HINT_LEN}
          placeholder="A short hint…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-800"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit(hint);
          }}
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          onClick={() => void submit(hint)}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Hint'}
        </button>
      </div>
    </div>
  );
}
