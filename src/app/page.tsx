import ControllerViewer from "@/components/controller-viewer";
import GameUniverseBackground from "@/components/game-universe-background";
import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import { controllerViewerConfig } from "@/lib/controller-config";

export default function Home() {
  return (
    <main className="h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white sm:h-auto sm:min-h-screen sm:overflow-x-hidden sm:overflow-y-auto">
       <GameUniverseBackground />
      <Navbar />

      <section className="relative isolate h-[calc(100svh-4rem)] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-[12%] top-[10%] size-105 rounded-full bg-cyan-500/10 blur-[120px] dark:bg-cyan-500/10" />

          <div className="absolute right-[8%] top-[18%] size-90 rounded-full bg-violet-500/10 blur-[110px] dark:bg-violet-500/10" />

          <div className="absolute -bottom-20 left-1/2 size-105 -translate-x-1/2 rounded-full bg-rose-500/5 blur-[120px]" />
        </div>

        <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Mobile: controller behind the Hero */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[44svh] sm:relative sm:inset-auto sm:h-auto">
            <div className="absolute inset-0 sm:hidden">
              <ControllerViewer
                fullscreen={false}
                {...controllerViewerConfig}
              />
            </div>
          </div>

          <div className="relative grid h-full min-h-0 grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-4">
            <Hero />

            {/* Desktop */}
            <div className="relative hidden min-h-135 lg:block lg:min-h-175">
              <div className="absolute inset-0">
                <ControllerViewer {...controllerViewerConfig} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
