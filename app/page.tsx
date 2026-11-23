"use client";

import { useState } from "react";
import ParticleBackground from "./components/ParticleBackground";
import Sidebar from "./components/Sidebar";

export default function Home() {
  const [ready, setReady] = useState(false);

  return (
    <div className="min-h-full bg-black text-white">
      <div className="fixed inset-0 z-0">
        <ParticleBackground
          src="/source.jpg"
          invert
          centerY={0.42}
          density={0.35}
          onReady={() => setReady(true)}
        />
      </div>

      <main className="relative z-10 flex h-dvh flex-col items-center justify-end px-6 pb-[20vh]">
        <div
          className={`flex flex-col items-center gap-6 text-center transition-opacity duration-150 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          <h1 className="text-5xl font-light tracking-tight text-white/90">
            pineapple
          </h1>
          <p className="max-w-sm text-white/50">building natural software</p>
        </div>
      </main>

      <Sidebar visible={ready} />

      <a
        href="https://github.com/PineappleLTD"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        className={`fixed top-6 right-6 z-30 text-white/50 transition-[color,opacity] duration-150 hover:text-white/90 ${
          ready ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
    </div>
  );
}
