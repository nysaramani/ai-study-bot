import Link from 'next/link';

export default function NavBar() {
  return (
    <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-white">
          Study Agent
        </Link>
        <nav className="flex gap-3">
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Chat
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
