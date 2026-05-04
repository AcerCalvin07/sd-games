'use client';

import Link from 'next/link';

interface GameCard {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

const GAMES: GameCard[] = [
  {
    slug: 'mister-white',
    name: 'Mister White',
    icon: '🎭',
    description: 'Find the imposter who doesn’t know the word. 5+ players.',
  },
];

export function HomeScreen() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">SD Games</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Pick a game to start.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {GAMES.map((game) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-blue-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-400"
          >
            <span className="text-4xl" aria-hidden>
              {game.icon}
            </span>
            <h2 className="text-lg font-semibold">{game.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{game.description}</p>
            <span className="mt-auto text-sm font-medium text-blue-600 group-hover:underline dark:text-blue-400">
              Play →
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
