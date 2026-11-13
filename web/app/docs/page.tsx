
import { ArcHeader } from "@/components/landing/arc-header";
import { Footer } from "@/components/landing/footer";
import { AppLink } from "@/components/ui/app-link";
import { href } from "@/lib/href";

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
    <section className="mt-6 border border-[#3a2418] bg-[#120c08]/70 p-7">
      <p className="font-display text-[10px] uppercase tracking-[0.3em] text-[#d9a45a]">
        {kicker}
      </p>
      <h2 className="mt-2 text-lg font-bold text-zinc-100">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="relative isolate min-h-dvh bg-[#0a0705] text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,122,61,0.10),transparent_60%)]"
      />
      <ArcHeader />

      <main className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-24">
        <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[#ff7a3d]">
          SolAde Games
        </p>
        <h1 className="font-display mt-3 text-3xl uppercase tracking-[0.16em] text-zinc-100">
          Docs
        </h1>
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
          <p>
            It is not a token, and not a payments platform. The house takes no rake. A
            published share of every paid entry goes to the holders of the machine being
            played, which is how the people who back the hall earn from it.
          </p>
        </Section>

        <Section kicker="Machines" title="The three games">
          <ul className="space-y-4">
            {GAMES.map((game) => (
              <li key={game.name}>
                <AppLink
                  to={href(game.route)}
                  className="font-semibold text-zinc-100 underline-offset-4 hover:text-[#ffb066] hover:underline"
                >
                  {game.name}
                </AppLink>
                <p className="mt-1">{game.desc}</p>
              </li>
            ))}
          </ul>
          <p>
            A daily puzzle sits at{" "}
            <AppLink
              to={href("/play")}
              className="text-zinc-200 underline decoration-[#7a4a2c] underline-offset-4 hover:text-[#ffb066]"
            >
              /play
            </AppLink>
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
          <p>
            <span className="font-semibold text-zinc-200">Not live:</span> any payment. No
            entry fees, no prize pools, no settlement. Devnet tooling exists in the
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
            Scene assets are built with Blender scripts in <code>art/</code>. The three games
            run entirely in the browser; the account API needs Postgres.
          </p>
          <p>
            The repository README carries the current product direction and the questions
            open with Bankroll.
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
