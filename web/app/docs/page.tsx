import Link from "next/link";

import { ArcHeader } from "@/components/landing/arc-header";
import { Footer } from "@/components/landing/footer";
import { GridTunnel } from "@/components/landing/grid-tunnel";

const GAMES = [
  {
    name: "Stack Tower",
    route: "/games/stack-tower",
    desc: "Pull a plank from the tower and place it on top. Real rigid bodies, so a pull can topple it.",
  },
  {
    name: "Brick Blitz",
    route: "/games/brick-blitz",
    desc: "Brick breaker on a billiard table. Six materials, each with its own hit, sound and score.",
  },
  {
    name: "Neon Pinball",
    route: "/games/pinball",
    desc: "A full table: flippers, bumpers, slingshots, a plunger, and bells in A minor pentatonic.",
  },
] as const;

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neon-edge [--neon:#5b9fd8] mt-8 rounded-xl bg-white/[0.03] p-7 shadow-[0_0_0_1px_rgba(91,159,216,0.24),0_0_24px_-10px_rgba(91,159,216,0.5)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-[#8fc0e8]">{kicker}</p>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <div className="mt-4 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="relative isolate min-h-dvh bg-black text-zinc-50">
      <GridTunnel />
      <ArcHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-24">
        <p className="text-xs uppercase tracking-[0.35em] text-[#8fc0e8]">SolAde Games</p>
        <h1 className="mt-2 text-4xl font-black">Docs</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
          A skill arcade of three machines, built to run on Bankroll&apos;s rails. Free to
          play on Solana devnet. No payments are taken.
        </p>

        <Section kicker="Overview" title="What this is">
          <p>
            SolAde Games is content: three deterministic games presented as a walkable
            arcade hall. Payments, age checks and matchmaking are not ours to run, and the
            product takes no cut of game revenue.
          </p>
          <p className="mt-3">
            It is not a token, not an NFT sale, and not a payments platform. Earlier drafts
            of this page described USDC entry fees, a holder share and a platform rake.
            None of that is built or planned as described.
          </p>
        </Section>

        <Section kicker="Machines" title="The three games">
          <ul className="space-y-4">
            {GAMES.map((game) => (
              <li key={game.name}>
                <Link
                  href={game.route}
                  className="font-semibold text-zinc-200 underline-offset-4 hover:text-white hover:underline"
                >
                  {game.name}
                </Link>
                <p className="mt-1">{game.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            A daily puzzle sits at{" "}
            <Link href="/play" className="text-zinc-200 underline underline-offset-4">
              /play
            </Link>
            . It is gated behind a player handle, so it is not playable for a first-time
            visitor.
          </p>
        </Section>

        <Section kicker="Status" title="What is live">
          <ul className="space-y-2">
            <li>The three cabinets, free to play, no wallet needed to start.</li>
            <li>The hall: an entrance, a bar, and three stations you click to enter.</li>
            <li>Wallet connect on Solana devnet, with a profile and per-game bests.</li>
            <li>The daily puzzle and its API, gated behind a handle.</li>
          </ul>
          <p className="mt-4">
            <span className="font-semibold text-zinc-200">Not live:</span> any payment.
            No entry fees, no prize pools, no settlement. Devnet tooling exists in the
            repository, but nothing runs and no funds move.
          </p>
        </Section>

        <Section kicker="Fairness" title="Why scores compare">
          <p>
            Every board is generated from a fixed seed, so two players in a round face the
            same machine. Pinball runs a fixed-timestep simulation; Stack Tower uses real
            physics bodies. Identical inputs give identical results, on any device.
          </p>
        </Section>

        <Section kicker="Engineering" title="How it is built">
          <p>
            Next.js with React Three Fiber, Rapier for physics, and Web Audio for sound.
            Scene assets are built with Blender scripts in <code>art/</code>. The three
            games run entirely in the browser; the account API needs Postgres.
          </p>
          <p className="mt-3">
            The repository README carries the current product direction and the questions
            open with Bankroll.
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
