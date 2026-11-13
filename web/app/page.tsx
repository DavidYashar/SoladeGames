import type { Metadata } from "next";

import { HallFront } from "@/components/hall/hall-front";

export const metadata: Metadata = {
  title: "ARC_ADE · The Hall",
  description: "Three skill machines on Solana. Stack Tower, Brick Blitz, Neon Pinball.",
};

export default function Home() {
  return <HallFront />;
}
