"use client";

import { useState } from "react";
import ParticleBackground from "./components/ParticleBackground";

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
    </div>
  );
}
