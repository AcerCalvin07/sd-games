import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">SD Game Manager</h1>
      <p className="text-neutral-400 text-sm">Choose a game to play.</p>
      <Link
        href="/games/mister-white"
        className="rounded-md bg-white text-neutral-950 px-5 py-2.5 text-sm font-medium hover:bg-neutral-200 transition"
      >
        Mr. White
      </Link>
    </main>
  );
}
