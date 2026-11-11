import type { Metadata } from "next";

import { StackTowerGame } from "@/components/games/stack-tower-3d";

export const metadata: Metadata = {
  title: "Stack Tower",
  description: "Drop the block. Perfect alignment keeps your width.",
};

export default function StackTowerPage() {
  return <StackTowerGame />;
}
