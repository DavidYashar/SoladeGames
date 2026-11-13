import type { Metadata } from "next";

import { HallFront } from "@/components/hall/hall-front";

export const metadata: Metadata = {
  title: "SolAde Games · The Hall",
  description: "Three skill games in a 3D arcade hall. Stack Tower, Brick Blitz, Neon Pinball.",
};

export default function Home() {
  return <HallFront />;
}
