'use client';
import { useEffect, useState } from 'react';

export default function IntegrityDemoPage() {
  const [signals, setSignals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/company/integrity-demo');
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        const data = await response.json();
        setSignals(data.signals);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading integrity report...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  );

  if (!signals) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">No data found.</p>
    </div>
  );

  const d1 = signals.d1_consistency ?? 0;
  const d2 = signals.d2_degradation ?? 0;
  const d3 = signals.d3_resume_mismatch ?? 0;
  const composite = signals.composite ?? 0;

  const bar = (val: number) => {
    const pct = Math.round(val * 100);
    const color = val < 0.2 ? 'bg-green-400'
                : val < 0.4 ? 'bg-yellow-400'
                : 'bg-red-400';
    return (
      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
        <div className={`${color} h-1.5 rounded-full transition-all`}
             style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    );
  };

  const badge = (val: number, label: string) => {
    const cls = val < 0.2
      ? 'bg-green-50 text-green-700 border-green-200'
      : val < 0.4
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
      : 'bg-red-50 text-red-700 border-red-200';
    const risk = val < 0.2 ? 'Low' : val < 0.4 ? 'Medium' : 'High';
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
        {risk} · {(val * 100).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs tracking-widest text-gray-400 font-medium uppercase mb-1">
            Recruiter View — Candidate Analysis
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Candidate Integrity Verification
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Post-session behavioural analysis across 3 signal layers.
            Signals are computed automatically after interview completion.
          </p>
        </div>

        {/* D1 Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                D1 — Cross-Answer Consistency
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Detects factual contradictions across multiple answers
              </p>
            </div>
            {badge(d1, 'Consistency')}
          </div>
          {bar(d1)}

          <div className="mt-4">
            {signals.d1_contradictions?.length > 0 ? (
              <div className="space-y-2">
                {signals.d1_contradictions.slice(0, 2).map((c: any, i: number) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">
                      Answer {c.answer_a} vs Answer {c.answer_b}
                    </p>
                    <p className="text-xs text-yellow-700 leading-relaxed">
                      {c.explanation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-4 h-4 rounded-full bg-green-100 
                                 flex items-center justify-center text-green-600 
                                 text-xs">✓</span>
                <p className="text-xs text-green-600">
                  No contradictions detected across answers
                </p>
              </div>
            )}
          </div>
        </div>

        {/* D2 Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                D2 — Answer Depth Analysis
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitors quality degradation on follow-up questions
              </p>
            </div>
            {badge(d2, 'Degradation')}
          </div>
          {bar(d2)}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <p className="text-xl font-semibold text-gray-900">
                {signals.d2_initial_depth?.toFixed(2) ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Initial depth score</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <p className="text-xl font-semibold text-gray-900">
                {signals.d2_followup_depth?.toFixed(2) ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Follow-up depth score</p>
            </div>
          </div>
          {signals.d2_degradation === null && (
            <p className="text-xs text-gray-400 mt-3">
              No follow-up answer data available for this session
            </p>
          )}
        </div>

        {/* D3 Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                D3 — Resume-Response Alignment
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Compares claimed skills with demonstrated knowledge in answers
              </p>
            </div>
            {badge(d3, 'Mismatch')}
          </div>
          {bar(d3)}

          <div className="mt-4">
            {signals.d3_skill_breakdown?.length > 0 ? (
              <div className="space-y-3">
                {signals.d3_skill_breakdown.slice(0, 4).map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between 
                                          py-2 border-b border-gray-50 last:border-0">
                    <p className="text-xs text-gray-700 font-medium">{s.skill}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${
                            s.match_score >= 0.7 ? 'bg-green-400'
                            : s.match_score >= 0.4 ? 'bg-yellow-400'
                            : 'bg-red-400'
                          }`}
                          style={{ width: `${s.match_score * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        s.match_score >= 0.7 ? 'text-green-600'
                        : s.match_score >= 0.4 ? 'text-yellow-600'
                        : 'text-red-600'
                      }`}>
                        {s.match_score >= 0.7 ? 'Strong'
                         : s.match_score >= 0.4 ? 'Partial'
                         : 'Weak'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                No resume skills could be matched to interview answers
              </p>
            )}
          </div>
        </div>

        {/* Composite Score */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm 
                        px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Composite Integrity Score
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Weighted combination of D1 + D2 + D3 signals
            </p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              Confidence level: {signals.confidence ?? 'low'}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-semibold ${
              composite < 0.2 ? 'text-green-600'
              : composite < 0.5 ? 'text-yellow-600'
              : 'text-red-600'
            }`}>
              {Math.round(composite * 100)}
              <span className="text-lg font-normal text-gray-300">/100</span>
            </p>
            <p className={`text-xs mt-1 font-medium ${
              composite < 0.2 ? 'text-green-500'
              : composite < 0.5 ? 'text-yellow-500'
              : 'text-red-500'
            }`}>
              {composite < 0.2 ? '✓ Low integrity risk'
               : composite < 0.5 ? '⚠ Medium integrity risk'
               : '✗ High integrity risk'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}