import type { Metadata } from "next";

import { PoolTable } from "@/components/games/pool-table";

export const metadata: Metadata = {
  title: "Table",
  description: "Billiard table, environment in progress.",
};

export default function PoolPage() {
  return <PoolTable />;
}
