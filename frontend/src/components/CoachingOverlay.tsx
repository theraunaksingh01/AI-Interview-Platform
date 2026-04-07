import React from "react";

interface CoachingOverlayProps {
  wpm: number;
  wpmStatus: "good" | "fast" | "too_fast";
  fillerCounts: Record<string, number>;
  currentSilenceSecs: number;
  showSilenceNudge: boolean;
  currentHint: string | null;
  hintLevel: 0 | 1 | 2;
  isAnswerActive: boolean;
  audioAgeMs: number;
  debug?: boolean;
}

function statusColor(status: CoachingOverlayProps["wpmStatus"]): string {
  if (status === "too_fast") return "bg-red-500";
  if (status === "fast") return "bg-amber-500";
  return "bg-emerald-500";
}

function statusText(status: CoachingOverlayProps["wpmStatus"]): string {
  if (status === "too_fast") return "Too fast";
  if (status === "fast") return "Slightly fast";
  return "Good pace";
}

export default function CoachingOverlay({
  wpm,
  wpmStatus,
  fillerCounts,
  currentSilenceSecs,
  showSilenceNudge,
  currentHint,
  hintLevel,
  isAnswerActive,
  audioAgeMs,
  debug = false,
}: CoachingOverlayProps) {
  const maxBar = 220;
  const percent = Math.max(0, Math.min(100, Math.round((wpm / maxBar) * 100)));

  const topFillers = Object.entries(fillerCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <aside className="w-80 shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Live coaching</h3>

      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-gray-500">Pace</div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full ${statusColor(wpmStatus)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-800">{wpm} WPM</span>
          <span className={`${wpmStatus === "too_fast" ? "text-red-600" : wpmStatus === "fast" ? "text-amber-600" : "text-emerald-600"}`}>
            {statusText(wpmStatus)}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-medium text-gray-500">Fillers</div>
        {topFillers.length === 0 ? (
          <p className="text-xs text-gray-400">No fillers detected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            {topFillers.map(([word, count]) => (
              <span
                key={word}
                className={`rounded-full px-2.5 py-1 ${count >= 5 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}
              >
                {word}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-1 text-xs font-medium text-gray-500">Silence</div>
        <p className="text-xs text-gray-700">{currentSilenceSecs}s (alert at 12s)</p>
      </div>

      {showSilenceNudge ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm">
          Silence alert: keep going and think out loud.
        </div>
      ) : null}

      {currentHint ? (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          <span className="font-semibold">Hint {hintLevel}:</span> {currentHint}
        </div>
      ) : null}

      {debug && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px",
            background: "#1a1a1a",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#00ff00",
          }}
        >
          <div>isAnswerActive: {String(isAnswerActive)}</div>
          <div>silence: {currentSilenceSecs}s</div>
          <div>wpm: {wpm}</div>
          <div>audioAge: {audioAgeMs}ms</div>
        </div>
      )}
    </aside>
  );
}
