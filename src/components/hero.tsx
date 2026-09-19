import Link from "next/link";

export default function Hero() {
  return (
    <div className="relative z-20 flex h-full min-h-[calc(100svh-4rem)] w-full max-w-2xl flex-col sm:min-h-0 sm:justify-center">
      {/* Content centered on mobile */}
      <div className="flex flex-1 mt-20 justify-center text-center sm:flex-none sm:text-left">
        <div className="w-full">
          <h1
            className="
    mx-auto max-w-[11ch]
    font-(family-name:--font-playwrite)
    text-[clamp(2.4rem,13vw,4rem)]
    font-normal
    leading-[0.92]
    tracking-tight
    sm:mx-0 sm:max-w-3xl
    sm:text-5xl
    md:text-6xl
    lg:text-7xl
  "
          >
            Find someone.
            <br />
            Pick a game.
            <br />
            <span className="bg-linear-to-r from-cyan-500 via-slate-950 to-violet-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-white dark:to-violet-300">
              Play.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-152 text-sm leading-6 text-slate-500 sm:mx-0 sm:mt-6 sm:text-base sm:leading-7 dark:text-white/55">
            Meet players, join realtime matches and compete across the games you
            love.
          </p>

          {/* Mobile */}
          <div className="mt-5 flex w-full items-center justify-center gap-x-4 text-center text-xs text-slate-400 sm:hidden dark:text-white/40">
            <span>2-player realtime</span>
            <span>Fast matchmaking</span>
            <span>Cross-device</span>
          </div>
        </div>
      </div>

      {/* Buttons stay at the bottom */}
      <div className="shrink-0 pb-6 pt-6 sm:pb-0 sm:pt-8">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/games"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            Play now
          </Link>

          <Link
            href="/how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-6 text-sm font-medium text-slate-950 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            How it works
          </Link>
        </div>

        {/* Desktop */}
        <div className="mt-6 hidden flex-wrap items-center gap-x-4 gap-y-3 text-xs text-slate-400 sm:flex sm:gap-x-6 dark:text-white/40">
          <span>2-player realtime</span>
          <span>Fast matchmaking</span>
          <span>Cross-device</span>
        </div>
      </div>
    </div>
  );
}
