"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One link, two behaviours.
 *
 * In the normal app this is Next's client router. In the static demo it is a plain
 * anchor, because the export's RSC payloads can point at chunks from a different build
 * when a host serves a mixed artifact, and the router then retries forever with no
 * visible error. A real page load always works: the route is a folder with an
 * index.html.
 */
export function AppLink({
  to,
  className,
  children,
  ariaLabel,
  onClick,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  if (process.env.NEXT_PUBLIC_DEMO === "1") {
    return (
      <a href={to} className={className} aria-label={ariaLabel} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={to} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  );
}
