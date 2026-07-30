"use client";

import Link from "next/link";
import { getRoleName, ROLE_CONFIG } from "@/lib/auth/roles";

const WORKFLOW_STEPS = [
  { n: "01", title: "Report", body: "A citizen submits an incident from the mobile app — location, description, and photo or video evidence." },
  { n: "02", title: "Triage", body: "The AI service scores priority and flags likely duplicates. Nothing here is final until a dispatcher confirms it." },
  { n: "03", title: "Dispatch", body: "A vehicle is assigned only once a crew is actively on shift for it. Responders get the mission the moment it's confirmed." },
  { n: "04", title: "Resolve", body: "Hospitals get advance notice when transport is inbound. Every state change is written to the incident's event history." },
];

const FEATURES = [
  { icon: "⚡", title: "Event-driven, not request-driven", body: "Spring Boot services coordinate over RabbitMQ, so a slow hospital lookup never blocks a dispatcher assigning a unit." },
  { icon: "📍", title: "Live by default", body: "WebSocket push keeps every open dashboard and app in sync with vehicle position — no dashboard is ever polling for what already happened." },
  { icon: "🧠", title: "AI recommends, humans decide", body: "Priority scoring, duplicate detection, and hospital ranking are all advisory. No incident is ever auto-dispatched." },
  { icon: "🔐", title: "One incident, seven scoped views", body: "Every actor works off the same incident record, but only ever sees the slice of it their role is permitted to." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors duration-300">
      {/* ================= HERO (Dark Accent Section) ================= */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* Background Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-87.5 w-87.5 sm:h-125 sm:w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-700/10 blur-3xl" />
          <div className="absolute right-0 top-0 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-red-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 px-4 sm:px-6 py-20 lg:flex-row lg:py-36">
          {/* Left Content */}
          <div className="flex-1 w-full text-center lg:text-left">
            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-red-300">
              AI-Powered Emergency Response Simulation
            </span>

            <h1 className="mt-6 text-4xl sm:text-5xl md:text-7xl font-bold leading-tight">
              A dispatch network,
              <br />
              <span className="text-red-500">
                simulated end to end.
              </span>
            </h1>

            <p className="mt-6 sm:mt-8 max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg leading-7 sm:leading-8 text-slate-300">
              NAJDA models how a citizen&apos;s report becomes a coordinated emergency
              response—from dispatcher to ambulance, police, fire department, and
              hospital—all sharing one incident timeline.
            </p>

            <p className="mt-4 sm:mt-6 max-w-2xl mx-auto lg:mx-0 text-sm sm:text-base text-slate-400 leading-6 sm:leading-7">
              Built as an academic simulation, the platform demonstrates workflows,
              communication, AI-assisted triage, and real-time synchronization found
              in modern emergency response systems while keeping human dispatchers in
              complete control of operational decisions.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-wrap justify-center lg:justify-start gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto text-center rounded-lg bg-red-600 px-8 py-4 font-semibold transition hover:bg-red-500 text-white shadow-md"
              >
                Login
              </Link>

              <a
                href="#workflow"
                className="w-full sm:w-auto text-center rounded-lg border border-slate-700 bg-slate-800/50 px-8 py-4 font-semibold transition hover:bg-slate-800 text-white"
              >
                Explore Workflow
              </a>
            </div>
          </div>

          {/* Right Visual Graphic */}
          <div className="relative flex flex-1 w-full justify-center py-10 lg:py-0">
            <div className="relative w-70 h-70 sm:w-95 sm:h-95 lg:w-125 lg:h-125 max-w-full rounded-full border border-red-500/20 flex items-center justify-center">
              <div className="absolute inset-8 sm:inset-12 rounded-full border border-red-500/20" />
              <div className="absolute inset-16 sm:inset-24 rounded-full border border-red-500/20" />

              <div className="absolute h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-600 shadow-[0_0_30px_#dc2626]" />

              {[
                "Citizen",
                "Dispatcher",
                "Ambulance",
                "Police",
                "Firefighter",
                "Hospital",
              ].map((item, i) => {
                const angle = (i / 6) * Math.PI * 2;
                const radius = typeof window !== "undefined" && window.innerWidth < 640 ? 110 : 180;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);

                return (
                  <div
                    key={item}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm shadow-xl backdrop-blur whitespace-nowrap text-white font-medium">
                      {item}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute -bottom-10 sm:-bottom-16 left-4 sm:left-6 rounded-2xl border border-slate-700 bg-slate-800/95 p-4 sm:p-6 backdrop-blur shadow-xl">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400">
                Live Synchronization
              </p>
              <div className="mt-1 sm:mt-2 text-3xl sm:text-4xl font-bold text-red-500">
                &lt;100ms
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                WebSocket update latency
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= WORKFLOW ================= */}
      <section id="workflow" className="bg-white dark:bg-slate-900 py-16 sm:py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-red-600 dark:text-red-400">
              End-to-End Workflow
            </p>

            <h2 className="mt-4 sm:mt-5 text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white">
              One incident.
              <br />
              Four coordinated stages.
            </h2>

            <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Every emergency follows the same traceable lifecycle, ensuring every
              participant sees the correct information at the correct moment.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-6 sm:gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.n}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 shadow-sm transition duration-300 hover:-translate-y-2 hover:border-red-500 hover:shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm font-bold tracking-[0.3em]">
                    {step.n}
                  </div>

                  <h3 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {step.title}
                  </h3>

                  <p className="mt-3 sm:mt-5 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600 dark:text-slate-300">
                    {step.body}
                  </p>
                </div>

                <div className="mt-6 sm:mt-8 h-1 w-0 rounded-full bg-red-600 transition-all duration-300 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ARCHITECTURE ================= */}
      <section className="bg-slate-100 dark:bg-slate-950/50 py-16 sm:py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-red-600 dark:text-red-400">
                Platform
              </p>

              <h2 className="mt-3 sm:mt-4 text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white">
                Built like a real emergency network.
              </h2>

              <p className="mt-6 sm:mt-8 text-base sm:text-lg leading-7 sm:leading-8 text-slate-600 dark:text-slate-300">
                Rather than simulating isolated pages, NAJDA models communication
                between independent services. Citizens, responders, dispatchers,
                hospitals and administrators all operate on a shared incident while
                only seeing information appropriate to their role.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-900 p-6 sm:p-10 text-white shadow-2xl border border-slate-800">
              <div className="space-y-4 sm:space-y-6">
                {[
                  "Citizen App",
                  "Spring Boot APIs",
                  "RabbitMQ Event Bus",
                  "AI Services",
                  "Dispatcher",
                  "Emergency Units",
                  "Hospital",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 sm:p-4 text-center text-sm sm:text-base font-medium text-white shadow-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="platform" className="bg-white dark:bg-slate-900 py-16 sm:py-24 transition-colors duration-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-red-600 dark:text-red-400">
              Platform Highlights
            </p>

            <h2 className="mt-3 sm:mt-4 text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white">
              Built for real-time coordination.
            </h2>

            <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Every component exists to demonstrate how modern emergency systems
              exchange information reliably, while keeping human operators in
              complete control.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-6 sm:gap-8 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 transition-all duration-300 hover:-translate-y-2 hover:border-red-500 hover:bg-white dark:hover:bg-slate-900 hover:shadow-xl"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/50 text-2xl sm:text-3xl">
                    {feature.icon}
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>

                    <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600 dark:text-slate-300">
                      {feature.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= ROLES (Dark Accent Section) ================= */}
      <section id="roles" className="bg-slate-950 py-16 sm:py-24 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-red-400">
              Access Control
            </p>

            <h2 className="mt-4 sm:mt-5 text-3xl sm:text-5xl font-bold">
              Nine roles.
              <br />
              One shared incident.
            </h2>

            <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg leading-7 sm:leading-8 text-slate-300">
              Every participant works from the same incident timeline while only
              seeing the information their responsibilities require. Role-based permissions ensure each participant interacts only
              with the information relevant to their operational responsibilities.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.keys(ROLE_CONFIG).map((role) => (
              <div
                key={role}
                className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 sm:p-6 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-red-500 hover:bg-slate-800 shadow-sm"
              >
                <h3 className="text-base sm:text-lg font-semibold text-white">{getRoleName(role)}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}