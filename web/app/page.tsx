import { ArcHeader } from "@/components/landing/arc-header";
import { FairnessSection } from "@/components/landing/fairness-section";
import { FeaturedPuzzle } from "@/components/landing/featured-puzzle";
import { Footer } from "@/components/landing/footer";
import { HallHero } from "@/components/landing/hall-hero";
import { MoneyFlow } from "@/components/landing/money-flow";
import { OwnershipSection } from "@/components/landing/ownership-section";
import { RoadmapSection } from "@/components/landing/roadmap-section";
import { GridTunnel } from "@/components/landing/grid-tunnel";
import { TournamentBanner } from "@/components/landing/tournament-banner";

/** Neon Arcade Hall — main landing / arcade hall. */
export default function Home() {
  return (
    <div className="relative isolate min-h-screen bg-black text-zinc-50">
      <GridTunnel />

      {/* Ambient glow behind content */}
      <div className="pointer-events-none absolute inset-0 -z-[5] bg-[radial-gradient(ellipse_at_top,rgba(60,100,150,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(28,60,92,0.10),transparent_55%)]" />

      <ArcHeader />

      <main className="relative flex flex-col gap-16 pb-10">
        <HallHero />
        <TournamentBanner />
        <FeaturedPuzzle />
        <MoneyFlow />
        <OwnershipSection />
        <RoadmapSection />
        <FairnessSection />
      </main>

      <Footer />
    </div>
  );
}
