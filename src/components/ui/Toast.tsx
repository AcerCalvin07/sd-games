'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastKind = 'info' | 'error' | 'success';

interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((ts) => [...ts, { id, message, kind }]);
    setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const api: ToastApi = {
    show,
    error: useCallback((m: string) => show(m, 'error'), [show]),
    success: useCallback((m: string) => show(m, 'success'), [show]),
    info: useCallback((m: string) => show(m, 'info'), [show]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Viewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function Viewport({ toasts }: { toasts: ToastEntry[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto max-w-md w-full rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm transition ${
            t.kind === 'error'
              ? 'bg-red-600/90 border-red-500 text-white'
              : t.kind === 'success'
                ? 'bg-green-600/90 border-green-500 text-white'
                : 'bg-neutral-800/90 border-neutral-700 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
