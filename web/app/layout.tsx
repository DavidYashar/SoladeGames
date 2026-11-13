import type { Metadata } from "next";
import { Chakra_Petch, Press_Start_2P, Silkscreen } from "next/font/google";
import { PlayerProvider } from "@/components/player-provider";
import { SolanaProvider } from "@/components/solana-provider";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

/*
 * Arcade type system (locked with the SOLADE wordmark):
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
    default: "SolAde Games · three skill games",
    template: "%s · SolAde Games",
  },
  description:
    "Three skill games in a 3D arcade hall. Free to play on Solana devnet.",
  applicationName: "SolAde Games",
  openGraph: {
    title: "SolAde Games",
    description:
      "Three skill games in a 3D arcade hall. Free to play on Solana devnet.",
    siteName: "SolAde Games",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SolAde Games",
    description:
      "Three skill games in a 3D arcade hall. Free to play on Solana devnet.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SolanaProvider>
          <PlayerProvider>{children}</PlayerProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
