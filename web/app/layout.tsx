import type { Metadata } from "next";
import { Chakra_Petch, Press_Start_2P, Silkscreen } from "next/font/google";
import { PlayerProvider } from "@/components/player-provider";
import { Web3Provider } from "@/components/web3-provider";
import "./globals.css";

/*
 * Arcade type system (locked with the ARC_ADE logo):
 *   heading → Press Start 2P   chunky 8-bit block letters, like the wordmark
 *   display → Silkscreen       bitmap labels, nav, buttons, HUD numerals
 *   sans    → Chakra Petch     squarish technical body copy
 */

const heading = Press_Start_2P({
  variable: "--font-arcade-heading",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const display = Silkscreen({
  variable: "--font-arcade-display",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const body = Chakra_Petch({
  variable: "--font-arcade-body",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "ARC_ADE — Skill arcade on Arc",
    template: "%s · ARC_ADE",
  },
  description:
    "Skill arcade and daily puzzle league. Practice free, compete in USDC on Arc.",
  applicationName: "ARC_ADE",
  openGraph: {
    title: "ARC_ADE — Skill arcade on Arc",
    description:
      "Four cabinet machines, one daily puzzle league. Practice free, compete in USDC on Arc.",
    siteName: "ARC_ADE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARC_ADE — Skill arcade on Arc",
    description:
      "Four cabinet machines, one daily puzzle league. Practice free, compete in USDC on Arc.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Web3Provider>
          <PlayerProvider>{children}</PlayerProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
