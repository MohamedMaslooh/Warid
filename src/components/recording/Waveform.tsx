// SPDX-License-Identifier: AGPL-3.0-or-later

interface WaveformProps {
  bars: number[];
  active: boolean;
}

export function Waveform({ bars, active }: WaveformProps) {
  return (
    <div className="flex items-end h-10 gap-[3px]">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] transition-all duration-100 ${active ? "waveform-bar" : ""}`}
          style={{
            background: active
              ? "linear-gradient(180deg, var(--accent-2), var(--accent))"
              : "var(--border-2)",
            height: active ? `${h}%` : "20%",
            borderRadius: 3,
          }}
        />
      ))}
    </div>
  );
}
