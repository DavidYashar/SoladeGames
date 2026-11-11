/** On-chain split donut (60/25/15) using a conic-gradient ring. */
const SEGMENTS = [
  { label: "Winners", pct: "60%", color: "#f7c948" },
  { label: "NFT holders", pct: "25%", color: "#22d3ee" },
  { label: "Platform", pct: "15%", color: "#a78bfa" },
] as const;

export function SplitDonut() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="h-40 w-40 rounded-full"
        style={{
          background:
            "conic-gradient(#f7c948 0 60%, #22d3ee 60% 85%, #a78bfa 85% 100%)",
          WebkitMask: "radial-gradient(circle, transparent 0 55%, black 56%)",
          mask: "radial-gradient(circle, transparent 0 55%, black 56%)",
        }}
      />
      <div className="space-y-1.5">
        {SEGMENTS.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-zinc-300">{s.pct} {s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
