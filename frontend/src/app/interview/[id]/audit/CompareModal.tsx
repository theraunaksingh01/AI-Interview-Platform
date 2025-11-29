// File: src/app/interview/[id]/audit/CompareModal.tsx
import React from "react";

export type AuditRow = {
  id: number;
  interview_id: string;
  scored_at?: string | null;
  created_at?: string | null;
  overall_score: number;
  section_scores: Record<string, number>;
  per_question: Array<any>;
  model_meta?: Record<string, any> | null;
  prompt_hash?: string | null;
  prompt_text?: string | null;
  weights?: Record<string, number> | null;
  triggered_by?: string | null;
  task_id?: string | null;
  llm_raw_s3_key?: string | null;
  notes?: string | null;
};

function computeSectionDiffs(left?: AuditRow | null, right?: AuditRow | null) {
  const secLeft = left?.section_scores || {};
  const secRight = right?.section_scores || {};
  const keys = Array.from(new Set([...Object.keys(secLeft), ...Object.keys(secRight)]));
  return keys.map((k) => {
    const l = Number(secLeft[k] ?? 0);
    const r = Number(secRight[k] ?? 0);
    const delta = Math.round((r - l) * 100) / 100;
    return { name: k, left: l, right: r, delta };
  });
}

function mapByQuestion(arr: any[] = []) {
  const m = new Map<number, any>();
  arr.forEach((p) => {
    const id = Number(p.question_id ?? p.questionId ?? p.qid ?? -1);
    if (!Number.isNaN(id) && id >= 0) m.set(id, p);
  });
  return m;
}

function computePerQuestionDiffs(left?: AuditRow | null, right?: AuditRow | null) {
  const leftMap = mapByQuestion(left?.per_question || []);
  const rightMap = mapByQuestion(right?.per_question || []);
  const qIds = Array.from(new Set([...Array.from(leftMap.keys()), ...Array.from(rightMap.keys())])).sort((a, b) => a - b);
  return qIds.map((qid) => {
    const L = leftMap.get(qid) || {};
    const R = rightMap.get(qid) || {};
    const lOverall = Number(L.overall ?? L.overall_score ?? 0);
    const rOverall = Number(R.overall ?? R.overall_score ?? 0);
    const delta = Math.round((rOverall - lOverall) * 100) / 100;
    return { qid, left: lOverall, right: rOverall, delta };
  });
}

export default function CompareModal({
  open,
  left,
  right,
  onClose,
}: {
  open: boolean;
  left?: AuditRow | null;
  right?: AuditRow | null;
  onClose: () => void;
}) {
  if (!open) return null;

  const sectionDiffs = computeSectionDiffs(left, right);
  const perQ = computePerQuestionDiffs(left, right);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl p-4 max-w-3xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">Comparison (Left → Right)</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded">Close</button>
        </div>

        <div className="mb-3 text-sm">
          <div className="font-medium">Runs</div>
          <div className="text-xs text-muted-foreground">Left: {left?.id ?? "—"} — Right: {right?.id ?? "—"}</div>
        </div>

        <div className="mb-4">
          <div className="font-medium">Section score diffs</div>
          <ul className="ml-4 list-disc text-sm">
            {sectionDiffs.map((s) => (
              <li key={s.name}>
                {s.name}: {s.left} → {s.right} ({s.delta >= 0 ? "+" + s.delta : s.delta})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="font-medium mb-2">Per-question overall diffs</div>
          <div className="text-sm space-y-2">
            {perQ.length === 0 && <div className="text-xs text-muted-foreground">No per-question data</div>}
            {perQ.map((d) => (
              <div key={d.qid} className="border rounded p-2">
                <div className="text-sm font-medium">Q{d.qid}</div>
                <div className="text-xs">Overall: {d.left} → {d.right} ({d.delta >= 0 ? "+" + d.delta : d.delta})</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

