'use client';

import { ToastProvider } from '@/components/ui/Toast';

export default function MisterWhiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen w-full flex flex-col overflow-hidden">{children}</div>
    </ToastProvider>
  );
}
