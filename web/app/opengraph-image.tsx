import { ImageResponse } from "next/og";

export const alt = "ARC_ADE — skill arcade and daily puzzle league on Arc";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card. Black field, white pixel wordmark, cyan→violet underscore.
 * Kept deliberately free of external fonts/images so the build never
 * depends on the network.
 */
export default async function OpengraphImage() {
  // The exact robot-A from the brand mark, inlined so the card never
  // depends on a font or a network fetch.
  const robotSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 9">` +
    `<rect x="3.2" y="0" width="0.6" height="1.3" fill="#ffffff"/>` +
    `<path d="M3.5 1.15 L6.6 2.75 V8.85 H0.4 V2.75 Z" fill="#ffffff"/>` +
    `<rect x="1.2" y="3.7" width="4.6" height="3.8" fill="#000000"/>` +
    `<rect x="1.95" y="4.7" width="1.05" height="1.5" fill="#22e0ff"/>` +
    `<rect x="4" y="4.7" width="1.05" height="1.5" fill="#22e0ff"/>` +
    `</svg>`;
  const robotUri = `data:image/svg+xml;utf8,${encodeURIComponent(robotSvg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#ffffff",
          position: "relative",
        }}
      >
        {/* cyan/violet corner glow */}
        <div
          style={{
            position: "absolute",
            top: -220,
            left: -160,
            width: 620,
            height: 620,
            borderRadius: 620,
            background:
              "radial-gradient(circle, rgba(34,224,255,0.22) 0%, rgba(34,224,255,0) 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -240,
            right: -180,
            width: 660,
            height: 660,
            borderRadius: 660,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.24) 0%, rgba(139,92,246,0) 70%)",
            display: "flex",
          }}
        />

        {/* wordmark row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 26,
            fontSize: 132,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          <span style={{ display: "flex" }}>ARC</span>

          {/* robot-A */}
          <img
            src={robotUri}
            width={102}
            height={131}
            style={{ marginTop: 6 }}
            alt=""
          />

          <span style={{ display: "flex" }}>DE</span>
        </div>

        {/* gradient underscore */}
        <div
          style={{
            width: 620,
            height: 14,
            marginTop: 26,
            background: "linear-gradient(90deg, #22e0ff 0%, #8b5cf6 100%)",
            display: "flex",
          }}
        />

        <div
          style={{
            marginTop: 40,
            fontSize: 34,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#a1a1aa",
            display: "flex",
          }}
        >
          Skill arcade · Daily puzzle league · USDC on Arc
        </div>
      </div>
    ),
    { ...size },
  );
}
