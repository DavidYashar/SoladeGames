import { ImageResponse } from "next/og";

export const alt = "SolAde Games — three skill games in an arcade hall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social card. Black field, white pixel wordmark, cyan→violet underscore.
 * Kept deliberately free of external fonts/images so the build never
 * depends on the network.
 */
export default async function OpengraphImage() {

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
          <span style={{ display: "flex" }}>SOLADE</span>
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
          Three skill games · Free to play · Solana devnet
        </div>
      </div>
    ),
    { ...size },
  );
}
