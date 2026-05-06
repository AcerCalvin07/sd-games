'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onHost: (name: string) => void;
  onJoin: (name: string) => void;
}

export default function EntryScreen({ onHost, onJoin }: Props) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = name.trim();
  const canProceed = trimmed.length > 0;

  return (
    <main className="min-h-screen w-full flex flex-col px-6 py-12">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black tracking-tight text-white">MR. WHITE</h1>
          <p className="text-neutral-500 text-sm mt-2">Find the impostor. Or be one.</p>
        </div>

        <label className="block mb-8">
          <span className="sr-only">Your name</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Your name"
            maxLength={32}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 text-lg text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition"
          />
        </label>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onHost(trimmed)}
            className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-semibold text-base transition px-6 py-4 flex flex-col items-start"
          >
            <span className="text-lg">Host</span>
            <span className="text-xs font-normal opacity-80">Create a new room and invite friends</span>
          </button>

          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onJoin(trimmed)}
            className="w-full min-h-[52px] rounded-xl bg-transparent border border-neutral-700 hover:border-neutral-500 disabled:border-neutral-800 disabled:text-neutral-600 text-white font-semibold text-base transition px-6 py-4 flex flex-col items-start"
          >
            <span className="text-lg">Join</span>
            <span className="text-xs font-normal opacity-80">Enter a room code to play</span>
          </button>
        </div>
      </div>
    </main>
  );
}
