import type { Metadata } from "next";
import Link from "next/link";

type Department = "Einkauf" | "Sales" | "Marketing";
type ToolStatus = "live" | "coming-soon";

type ToolCard = {
  name: string;
  description: string;
  departments: Department[];
  href?: string;
  status: ToolStatus;
  accent: "blue" | "violet" | "emerald";
  icon: "market" | "price" | "mail";
};

export const metadata: Metadata = {
  title: "Bonmercato Toolbox",
  description: "Zentrale Übersicht für alle Tools der Bonmercato WebApp.",
};

const tools: ToolCard[] = [
  {
    name: "Market Tracker",
    description:
      "Verfolge die relevantesten Marktbewegungen, Kategorien und Produktchancen und springe direkt in deine laufenden Analysen.",
    departments: ["Einkauf"],
    href: "/category-analysis",
    status: "live",
    accent: "blue",
    icon: "market",
  },
  {
    name: "Preisvergleich",
    description:
      "Beobachte Preise, Bewertungen, BSR und Wettbewerbsdynamiken deiner Konkurrenzprodukte – von der aktuellen Momentaufnahme bis zum langfristigen Trend.",
    departments: ["Einkauf", "Sales"],
    href: "/price-comparison",
    status: "live",
    accent: "violet",
    icon: "price",
  },
  {
    name: "Trusted Shops Tool",
    description:
      "Bereite Trusted Shops Mail-Listen effizient vor und filtere Kundinnen und Kunden heraus, die bereits im Kontakt mit dem Support stehen.",
    departments: ["Marketing"],
    href: "/trusted-shops",
    status: "live",
    accent: "emerald",
    icon: "mail",
  },
];

const departmentStyles: Record<Department, string> = {
  Einkauf: "border-sky-400/25 bg-sky-400/12 text-sky-200",
  Sales: "border-violet-400/25 bg-violet-400/12 text-violet-200",
  Marketing: "border-emerald-400/25 bg-emerald-400/12 text-emerald-200",
};

const accentStyles: Record<ToolCard["accent"], { glow: string; border: string; icon: string; button: string }> = {
  blue: {
    glow: "from-sky-500/30 via-cyan-400/15 to-transparent",
    border: "hover:border-sky-400/40",
    icon: "from-sky-500/25 to-cyan-400/15 text-sky-200",
    button: "group-hover:text-sky-200",
  },
  violet: {
    glow: "from-violet-500/30 via-fuchsia-400/15 to-transparent",
    border: "hover:border-violet-400/40",
    icon: "from-violet-500/25 to-fuchsia-400/15 text-violet-200",
    button: "group-hover:text-violet-200",
  },
  emerald: {
    glow: "from-emerald-500/30 via-teal-400/15 to-transparent",
    border: "hover:border-emerald-400/40",
    icon: "from-emerald-500/25 to-teal-400/15 text-emerald-200",
    button: "group-hover:text-emerald-200",
  },
};

export default function ToolboxPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:36px_36px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 sm:px-8 lg:px-12">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_32%,transparent_68%,rgba(255,255,255,0.04))]" />

          <div className="relative max-w-3xl">
            <h1 className="max-w-4xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Willkommen in der{" "}
                <span className="bg-gradient-to-r from-white via-sky-200 to-violet-200 bg-clip-text text-transparent">
                Bonmercato Toolbox
                </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Von hier aus erreichst du alle aktuellen Tools der Bonmercato WebApp. 
                Die Tools wurden entwickelt um dich bei der Arbeit und bei Entscheidungsprozessen zu unterstützen. 
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Beta Version von Market Tracker & Preisvergleich verfügbar 
                </div>
            </div>
            </div>
        </section>

        <section className="relative mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool, index) => {
            const accent = accentStyles[tool.accent];
            const isLive = tool.status === "live";
            const cardClassName = `group relative overflow-hidden rounded-[26px] border border-white/10 bg-[#0d0d0d]/90 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.38)] transition duration-300 ${accent.border} ${
            isLive ? "hover:-translate-y-1.5 hover:bg-[#111111]" : "opacity-95"
            }`;

            const cardContent = (
            <>
                <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent.glow} opacity-80`} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_35%)]" />

                <div className="relative flex min-h-[320px] flex-col">
                <div className="flex items-start justify-between gap-4">
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${accent.icon}`}>
                    <ToolIcon kind={tool.icon} />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                    {tool.departments.map((department) => (
                        <span
                        key={department}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${departmentStyles[department]}`}
                        >
                        {department}
                        </span>
                    ))}
                    </div>
                </div>

                <div className="mt-8">
                    <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-[-0.03em] text-white">{tool.name}</h2>
                    {!isLive ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                        Soon
                        </span>
                    ) : null}
                    </div>

                    <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300 sm:text-[15px]">
                    {tool.description}
                    </p>
                </div>

                <div className="mt-auto pt-8">
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                    <span>{isLive ? "Tool öffnen" : "Link folgt später"}</span>
                    <span className={`text-base transition ${accent.button}`}>
                        {isLive ? "→" : "•"}
                    </span>
                    </div>
                </div>
                </div>
            </>
            );

            return isLive ? (
            <Link
                key={tool.name}
                href={tool.href!}
                className={cardClassName}
                style={{ animationDelay: `${index * 90}ms` }}
            >
                {cardContent}
            </Link>
            ) : (
            <div
                key={tool.name}
                className={cardClassName}
                style={{ animationDelay: `${index * 90}ms` }}
            >
                {cardContent}
            </div>
            );
          })}
        </section>

        <footer className="mt-10 pb-2 pt-6 text-center text-xs tracking-[0.18em] text-zinc-500">
          WebApp made by Matteo
        </footer>
      </div>

      <style>{`
        .aurora {
            animation-duration: 14s;
            animation-iteration-count: infinite;
            animation-timing-function: ease-in-out;
        }

        .aurora-a {
            animation-name: floatA;
        }

        .aurora-b {
            animation-name: floatB;
        }

        .aurora-c {
            animation-name: floatC;
        }

        .orbit-ring {
            position: relative;
            overflow: visible;
        }

        .orbit-ring::after {
            content: "";
            position: absolute;
            inset: -7px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            animation: spinRing 7s linear infinite;
        }

        @keyframes floatA {
            0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
            transform: translate3d(44px, 26px, 0) scale(1.08);
            }
        }

        @keyframes floatB {
            0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
            transform: translate3d(-34px, 20px, 0) scale(1.12);
            }
        }

        @keyframes floatC {
            0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
            transform: translate3d(26px, -18px, 0) scale(1.05);
            }
        }

        @keyframes spinRing {
            from {
            transform: rotate(0deg);
            }
            to {
            transform: rotate(360deg);
            }
        }
        `}</style>
    </main>
  );
}

function ToolIcon({ kind }: { kind: ToolCard["icon"] }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "market") {
    return (
      <svg {...common}>
        <path d="M4 18h16" />
        <path d="M6 15.5 10.2 11l3.3 2.8L18 8.5" />
        <path d="M15.8 8.5H18v2.2" />
      </svg>
    );
  }

  if (kind === "price") {
    return (
      <svg {...common}>
        <path d="M7 7h10" />
        <path d="M7 12h7" />
        <path d="M7 17h4" />
        <path d="m17 5 2 2-5.25 5.25H11.5V10z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 7.5h14" />
      <path d="M7 5v5" />
      <path d="M17 5v5" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 14 2.3 2.3L16 10.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-sky-200"
    >
      <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 4v3" />
      <path d="M20.5 5.5h-3" />
    </svg>
  );
}
