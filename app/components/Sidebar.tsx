"use client";

import { useEffect, useState } from "react";
import Apply from "./Apply";
import Waitlist from "./Waitlist";

type Tab = "projects" | "contact" | "apply";

const TABS: Tab[] = ["projects", "contact", "apply"];

const CONTACT_EMAIL = "pineapple@umich.edu";

type Project = {
  name: string;
  tagline: string;
  // Projects without details are listed but can't be opened.
  details?: {
    link?: { href: string; label: string };
    sections?: { title: string; body: string }[];
    waitlist?: boolean;
  };
};

const PROJECTS: Project[] = [
  {
    name: "basket",
    tagline: "Building the next prediction platform",
    details: { waitlist: true },
  },
  {
    name: "vendr",
    tagline:
      "A place for comparing prices, selling things and finding coupons.",
    details: {
      link: { href: "https://github.com/PineappleLTD/vendr", label: "GitHub" },
      sections: [
        {
          title: "Shop",
          body: 'Searches Amazon, eBay, Etsy, Best Buy, Walmart and Target at once and sorts the results by price. You can narrow them down by typing something like "new only, under $200".',
        },
        {
          title: "Sell",
          body: "You describe what you're selling, and it finds similar listings on eBay, Mercari and Facebook Marketplace, suggests a price for each site and writes the listing for you.",
        },
        {
          title: "Deals",
          body: "Finds coupon codes and sales for a store and links each one to the page it came from. There are no affiliate links or tracking.",
        },
        {
          title: "Sources",
          body: "Each price and coupon code is checked against the page it came from, and anything that doesn't appear there is left out.",
        },
      ],
    },
  },
  {
    name: "blueguessr",
    tagline: "GeoGuessr for the UMich campus",
    details: {
      link: { href: "https://blueguessr.vercel.app", label: "Website" },
    },
  },
];

export default function Sidebar({ visible }: { visible: boolean }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const open = tab !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (project) setProject(null);
      else setTab(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, project]);

  const toggle = (t: Tab) => {
    setProject(null);
    setTab((cur) => (cur === t ? null : t));
  };

  const tabClass = (t: Tab) =>
    `transition-colors duration-150 hover:text-white/90 ${
      tab === t ? "text-white/90" : "text-white/50"
    }`;

  return (
    <>
      <nav
        className={`fixed top-6 left-6 z-30 flex gap-6 text-sm font-light tracking-tight transition-opacity duration-150 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-expanded={tab === t}
            aria-controls="sidebar"
            className={tabClass(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div
        onClick={() => setTab(null)}
        aria-hidden
        className={`fixed inset-0 z-10 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="sidebar"
        aria-label={project?.name ?? tab ?? undefined}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-20 flex w-full flex-col overflow-y-auto border-r border-white/10 bg-black/70 px-8 pt-24 pb-10 backdrop-blur-md transition-[translate,max-width,background-color] duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${project ? "max-w-full bg-black/85" : "max-w-sm"}`}
      >
        {tab === "projects" && !project && (
          <ul className="flex flex-col gap-6">
            {PROJECTS.map((p) => (
              <li key={p.name}>
                {p.details ? (
                  <button
                    type="button"
                    onClick={() => setProject(p)}
                    className="group w-full text-left"
                  >
                    <span className="block text-lg font-light text-white/90 transition-colors group-hover:text-white">
                      {p.name}
                    </span>
                    <span className="mt-1 block text-sm text-white/50 transition-colors group-hover:text-white/70">
                      {p.tagline}
                    </span>
                  </button>
                ) : (
                  <>
                    <span className="block text-lg font-light text-white/90">
                      {p.name}
                    </span>
                    <span className="mt-1 block text-sm text-white/50">
                      {p.tagline}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {tab === "projects" && project?.details && (
          <div className="flex w-full max-w-3xl flex-col">
            <button
              type="button"
              onClick={() => setProject(null)}
              className="self-start text-sm text-white/50 transition-colors hover:text-white/90"
            >
              ← projects
            </button>

            <h3 className="mt-8 text-4xl font-light tracking-tight text-white/90 md:text-5xl">
              {project.name}
            </h3>
            <p className="mt-3 text-base text-white/50">{project.tagline}</p>

            {project.details.waitlist && (
              <div className="mt-12">
                <Waitlist />
              </div>
            )}

            {project.details.sections && (
              <dl className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
                {project.details.sections.map((s) => (
                  <div key={s.title}>
                    <dt className="text-sm text-white/80">{s.title}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-white/50">
                      {s.body}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {project.details.link && (
              <a
                href={project.details.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-12 self-start text-sm text-white/70 transition-colors hover:text-white"
              >
                {project.details.link.label} <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}

        {tab === "contact" && (
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="self-start font-mono text-sm text-white/50 transition-colors hover:text-white/90"
          >
            {CONTACT_EMAIL}
          </a>
        )}

        {tab === "apply" && (
          <div className="flex flex-col gap-8">
            <p className="text-sm leading-relaxed text-white/50">
              Pineapple is not recruiting right now. Keep watching this website
              for when winter 2027 applications come out.
            </p>
            <Apply />
          </div>
        )}
      </aside>
    </>
  );
}
