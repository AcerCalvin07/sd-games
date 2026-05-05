export default function MisterWhiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen w-full flex flex-col overflow-hidden">{children}</div>;
}
