interface LoadingProps {
  label?: string;
}

export function Loading({ label }: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 p-6"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
      {label && <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>}
    </div>
  );
}
