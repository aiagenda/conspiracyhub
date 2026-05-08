"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_LINES = [
  "[ ORACLE COMPUTATION IN PROGRESS... ]",
  "> CIA FOIA database scanner initialized...",
  "> USPTO patent search engine active...",
  "> Cross-linking patent corpus signals...",
  "> Building Bayesian inference graph...",
  "> Applying source-tier confidence weighting...",
];

const TYPE_MS = 22;
const LINE_PAUSE_MS = 180;

export default function OracleLoadingScreen() {
  const [lineIndex, setLineIndex] = useState(0);
  const [column, setColumn] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const currentFull = STATUS_LINES[lineIndex] ?? "";

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lineIndex >= STATUS_LINES.length) return undefined;

    if (column < currentFull.length) {
      const id = window.setTimeout(() => setColumn((c) => c + 1), TYPE_MS);
      return () => clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setLineIndex((i) => i + 1);
      setColumn(0);
    }, LINE_PAUSE_MS);
    return () => clearTimeout(id);
  }, [lineIndex, column, currentFull.length]);

  const { completedLines, activeLine } = useMemo(() => {
    const completed = STATUS_LINES.slice(0, lineIndex);
    const active = lineIndex < STATUS_LINES.length ? currentFull.slice(0, column) : "";
    return { completedLines: completed, activeLine: active };
  }, [lineIndex, column, currentFull]);

  const typingDone = lineIndex >= STATUS_LINES.length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050c07] text-[#5a8068]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#0d2818 1px, transparent 1px), linear-gradient(90deg, #0d2818 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,187,102,0.15) 2px, rgba(0,187,102,0.15) 4px)",
          animation: "scan-move 6s linear infinite",
        }}
      />
      <style>{`
        @keyframes scan-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(24px); }
        }
        @keyframes node-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(0,187,102,0.35)); }
          50% { filter: drop-shadow(0 0 14px rgba(0,187,102,0.85)); }
        }
        @keyframes dash-march {
          to { stroke-dashoffset: -40; }
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16 md:flex-row md:items-center md:justify-between md:py-10">
        <div className="max-w-xl flex-1">
          <div className="mb-8 font-mono text-xs uppercase tracking-[0.35em] text-[#1a3320]">Standby</div>

          <div className="space-y-3 font-mono text-sm leading-relaxed md:text-base">
            {completedLines.map((line) => (
              <div key={line} className={line.startsWith("[") ? "text-[#00bb66]" : "text-[#7aaa8a]"}>
                {line}
              </div>
            ))}
            {!typingDone ? (
              <div className="text-[#7aaa8a]">
                {activeLine}
                <span className="ml-0.5 inline-block animate-pulse text-[#00bb66]">▌</span>
              </div>
            ) : null}
            {typingDone ? (
              <div className="mt-6 flex items-center gap-3 text-[#5a8068]">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#00bb66]" />
                <span>Streaming structured intel…</span>
              </div>
            ) : null}
          </div>

          <div className="mt-10 font-mono text-xs text-[#3d5c47]">
            Elapsed ~{elapsed}s — Oracle may take 15–45s depending on load
          </div>
        </div>

        <div className="flex flex-1 justify-center md:justify-end">
          <div className="relative h-[min(52vh,420px)] w-full max-w-[420px]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-lg border border-[#1a3320]/80 bg-[#050c07]/60 shadow-[0_0_60px_rgba(0,187,102,0.08)]"
            />
            <svg className="relative h-full w-full p-6" viewBox="0 0 320 320" fill="none">
              <defs>
                <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#1a3320" offset="0%" />
                  <stop stopColor="#00bb66" offset="100%" />
                </linearGradient>
              </defs>

              <g style={{ animation: "orbit-spin 28s linear infinite", transformOrigin: "160px 160px", opacity: 0.35 }}>
                <circle cx="160" cy="160" r="118" stroke="#1a3320" strokeWidth="1" strokeDasharray="6 10" />
              </g>

              {[
                [160, 58],
                [248, 118],
                [220, 238],
                [100, 238],
                [72, 118],
              ].map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={i === 0 ? 10 : 7}
                  fill="#050c07"
                  stroke="#00bb66"
                  strokeWidth="1.5"
                  style={{
                    animation: `node-glow ${2.4 + i * 0.35}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}

              {[
                "M160,68 L242,124",
                "M242,124 L210,228",
                "M210,228 L110,228",
                "M110,228 L78,124",
                "M78,124 L160,68",
                "M160,160 L242,124",
                "M160,160 L210,228",
                "M160,160 L110,228",
                "M160,160 L78,124",
              ].map((d, i) => (
                <path
                  key={d}
                  d={d}
                  stroke="url(#edgeGrad)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeDasharray="10 14"
                  opacity={0.45 + (i % 3) * 0.12}
                  style={{ animation: "dash-march 2.8s linear infinite" }}
                />
              ))}

              <text x="160" y="168" textAnchor="middle" fill="#5a8068" fontSize="11" fontFamily="ui-monospace, monospace">
                INFERENCE
              </text>
              <text x="160" y="184" textAnchor="middle" fill="#3d5c47" fontSize="9" fontFamily="ui-monospace, monospace">
                graph compile
              </text>

              <circle cx="160" cy="160" r="4" fill="#00bb66">
                <animate attributeName="opacity" values="0.35;1;0.35" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </svg>

            <div className="pointer-events-none absolute bottom-4 left-4 right-4 font-mono text-[10px] text-[#3d5c47]">
              <div className="flex justify-between border-t border-[#1a3320] pt-2">
                <span>NODES</span>
                <span className="text-[#5a8068]">PROVISIONAL</span>
                <span>EDGES</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
