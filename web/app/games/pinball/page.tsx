import type { Metadata } from "next";

import { PinballTable } from "@/components/games/pinball-table";

export const metadata: Metadata = {
  title: "Neon Pinball",
  description: "Pinball table, environment in progress.",
};

export default function PinballPage() {
  return <PinballTable />;
}
