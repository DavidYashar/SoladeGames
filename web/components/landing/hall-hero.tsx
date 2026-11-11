import { CabinetPreview } from "./cabinet-preview";

const CABINETS = [
  {
    name: "Stack Tower",
    control: "Tap to drop",
    accent: "sky",
    kind: "tower",
    bestKey: "imarket:stack-tower:best",
  },
  {
    name: "Brick Blitz",
    control: "Drag the paddle",
    accent: "ocean",
    kind: "brick",
    bestKey: "imarket:brick-blitz:best",
  },
  {
    name: "Bubble Pop",
    control: "Aim · shoot · chain",
    accent: "ice",
    kind: "bubble",
    bestKey: "imarket:bubble-pop:best",
  },
  {
    name: "Neon Pinball",
    control: "Flippers · plunger",
    accent: "indigo",
    kind: "pinball",
    bestKey: "imarket:pinball:best",
  },
] as const;

/** Neon hall: hero copy + the cabinet row (the product). id="machines". */
export function HallHero() {
  return (
    <section id="machines" className="mx-auto w-full max-w-6xl px-6 pb-4 pt-14">
      <div className="text-center">
        <p className="font-display text-[11px] uppercase tracking-[0.28em] text-[#22e0ff]">
          Skill arcade · USDC on Arc · Free practice
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent sm:text-6xl">
          Play for skill.{" "}
          <span className="arcade-gradient-text">Settle in USDC.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
          Walk the hall. Same seeded board for every player. Practice free — or
          put 1 USDC on tonight&apos;s tournament. Best score at midnight UTC
          wins.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#machines" className="arcade-btn">
            Browse the machines
          </a>
          <a href="/play" className="arcade-btn-ghost">
            Today&apos;s puzzle
          </a>
        </div>
      </div>

      <div className="mb-4 mt-14 flex items-end justify-between">
        <h2 className="font-display text-[11px] uppercase tracking-[0.25em] text-zinc-500">
          The hall
        </h2>
        <p className="text-xs text-zinc-600">Rebuilding in 3D</p>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        {CABINETS.map((c) => (
          <div
            key={c.name}
            className="h-full min-w-[72%] shrink-0 snap-center sm:min-w-0"
          >
            <CabinetPreview {...c} />
          </div>
        ))}
      </div>
    </section>
  );
}
