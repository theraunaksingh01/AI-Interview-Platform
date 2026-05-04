
"use client";

import React from 'react';

interface IntegrityPanelProps {
  cheatSignals: any[];
}

const pct = (v: number | undefined | null) => Math.round((v || 0) * 100);

const colorFor = (v: number | undefined | null) => {
  const n = v ?? 0;
  if (n < 0.2) return 'bg-emerald-500';
  if (n < 0.4) return 'bg-yellow-400';
  return 'bg-red-500';
};

const ProgressBar: React.FC<{ value: number | null | undefined; className?: string }> = ({ value, className = '' }) => {
  const percent = Math.max(0, Math.min(100, Math.round((value || 0) * 100)));
  return (
    <div className="w-full bg-gray-100 rounded h-2 overflow-hidden">
      <div className={`${className} h-2`} style={{ width: `${percent}%` }} />
    </div>
  );
};

export default function IntegrityPanel({ cheatSignals }: IntegrityPanelProps) {
  const categoryD = (cheatSignals || []).find((s) => s && s.signal_type === 'category_d');
  const signals = categoryD?.payload?.signals || null;

  if (!signals) {
    return (
      <div className="border rounded-lg bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900">Integrity Verification</h3>
        <p className="text-sm text-gray-500 mt-2">Integrity analysis not yet available for this session.</p>
      </div>
    );
  }

  const d1_consistency = signals.d1_consistency ?? 0;
  const d1_contradictions = Array.isArray(signals.d1_contradictions) ? signals.d1_contradictions : [];
  const d2_degradation = signals.d2_degradation ?? null;
  const d2_initial_depth = signals.d2_initial_depth ?? 0;
  const d2_followup_depth = signals.d2_followup_depth ?? 0;
  const d3_resume_mismatch = signals.d3_resume_mismatch ?? 0;
  const d3_skill_breakdown = Array.isArray(signals.d3_skill_breakdown) ? signals.d3_skill_breakdown : [];
  const d3_mismatches = Array.isArray(signals.d3_mismatches) ? signals.d3_mismatches : [];
  const composite = signals.composite ?? 0;
  const flag = !!signals.flag;
  const confidence = signals.confidence ?? null;

  const compositePct = Math.round(composite * 100);
  const compositeColor = compositePct < 20 ? 'text-emerald-700 bg-emerald-50' : compositePct < 50 ? 'text-yellow-800 bg-yellow-50' : 'text-red-700 bg-red-50';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Integrity Verification</h3>
          <p className="text-sm text-gray-500">Automated Category D analysis</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded text-sm font-semibold ${compositeColor}`}>{compositePct < 20 ? 'Low' : compositePct < 50 ? 'Medium' : 'High'}</div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Composite</div>
            <div className="text-sm font-bold text-gray-900">{compositePct}%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SECTION 1 - D1 */}
        <div className="border rounded p-3 bg-gray-50">
          <h4 className="font-semibold text-gray-800">Cross-Answer Consistency</h4>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">Score</div>
              <div className="text-sm font-semibold">{pct(d1_consistency)}%</div>
            </div>
            <ProgressBar value={d1_consistency} className={colorFor(d1_consistency)} />
          </div>

          <div className="mt-3">
            {d1_contradictions.length > 0 ? (
              <div className="space-y-2">
                {d1_contradictions.map((c: any, i: number) => {
                  const a = c.answer_a ?? c.a ?? 'A';
                  const b = c.answer_b ?? c.b ?? 'B';
                  const explanation = c.explanation ?? c.reason ?? JSON.stringify(c);
                  return (
                    <div key={i} className="bg-yellow-50 border border-yellow-100 p-2 rounded text-sm text-yellow-800">
                      Answer {a} vs Answer {b}: {explanation}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-emerald-700">No contradictions detected</p>
            )}
          </div>
        </div>

        {/* SECTION 2 - D2 */}
        <div className="border rounded p-3 bg-gray-50">
          <h4 className="font-semibold text-gray-800">Answer Depth Analysis</h4>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">Degradation</div>
              <div className="text-sm font-semibold">{d2_degradation === null ? '—' : `${pct(d2_degradation)}%`}</div>
            </div>
            <ProgressBar value={d2_degradation ?? 0} className={colorFor(d2_degradation ?? 0)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-white p-2 border rounded text-sm">
              <div className="text-xs text-gray-500">Initial depth</div>
              <div className="font-semibold text-gray-900">{pct(d2_initial_depth)}%</div>
            </div>
            <div className="bg-white p-2 border rounded text-sm">
              <div className="text-xs text-gray-500">Follow-up depth</div>
              <div className="font-semibold text-gray-900">{pct(d2_followup_depth)}%</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            {d2_degradation === null ? <span className="text-gray-500">No follow-up data available</span> : null}
          </div>
        </div>

        {/* SECTION 3 - D3 */}
        <div className="border rounded p-3 bg-gray-50">
          <h4 className="font-semibold text-gray-800">Resume-Response Alignment</h4>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">Score</div>
              <div className="text-sm font-semibold">{pct(d3_resume_mismatch)}%</div>
            </div>
            <ProgressBar value={d3_resume_mismatch} className={colorFor(d3_resume_mismatch)} />
          </div>

          <div className="mt-3 space-y-2">
            {d3_skill_breakdown.length > 0 ? (
              d3_skill_breakdown.map((s: any, i: number) => {
                const name = s.skill || s.name || `Skill ${i + 1}`;
                const score = s.match_score ?? s.score ?? 0;
                const pillColor = score < 0.2 ? 'bg-emerald-100 text-emerald-800' : score < 0.4 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">{name}</div>
                    <div className={`px-2 py-1 rounded text-sm font-semibold ${pillColor}`}>{Math.round((score || 0) * 100)}%</div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">No resume skills matched to answers</p>
            )}
          </div>

          {d3_mismatches.length > 0 && (
            <div className="mt-3">
              <h5 className="text-sm font-semibold text-gray-800">Mismatches</h5>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                {d3_mismatches.map((m: any, i: number) => (
                  <li key={i}>{typeof m === 'string' ? m : JSON.stringify(m)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 bg-gray-50 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-medium text-gray-700">Composite Integrity Score</div>
        <div className="mt-2 md:mt-0 text-lg font-bold text-gray-900">{(composite * 100).toFixed(0)}/100</div>
      </div>

      <div className="mt-2 text-sm text-gray-500">Confidence: {confidence ?? '—'}</div>
    </div>
  );
}
