'use client';

interface Props {
  onHost: () => void;
  onJoin: () => void;
}

export default function EntryScreen({ onHost, onJoin }: Props) {
  void onHost;
  void onJoin;
  return <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">EntryScreen — Artifact 05</div>;
}
