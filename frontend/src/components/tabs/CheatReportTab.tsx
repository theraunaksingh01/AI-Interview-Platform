'use client';

import { CandidateDetail } from '@/types/candidates';

interface CheatReportTabProps {
  candidate: CandidateDetail;
}

export default function CheatReportTab({ candidate }: CheatReportTabProps) {
  if (!candidate.cheat_signals || candidate.cheat_signals.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-900 font-semibold">No cheat signals detected</p>
          <p className="text-green-800 text-sm mt-1">This interview shows low cheat risk</p>
        </div>
      </div>
    );
  }

  // Group signals by answer
  const signalsByAnswer = candidate.cheat_signals.reduce(
    (acc, signal: any) => {
      const answerId = signal.interview_answer_id || 'general';
      if (!acc[answerId]) acc[answerId] = [];
      acc[answerId].push(signal);
      return acc;
    },
    {} as Record<string | number, any[]>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Overall Cheat Score</p>
            <p className="text-4xl font-bold text-red-600">
              {candidate.cheat_score?.toFixed(0) || '–'}/100
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {candidate.cheat_risk || 'Unknown'} Risk
            </p>
          </div>
        </div>
      </div>

      {/* Per-Question Signals */}
      <div className="space-y-4">
        {Object.entries(signalsByAnswer).map(([answerId, signals]) => (
          <div key={answerId} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Answer {answerId === 'general' ? '(General)' : `#${answerId}`}
            </h3>

            <div className="space-y-3">
              {signals.map((signal: any, idx: number) => (
                <div
                  key={idx}
                  className={`border-l-4 p-3 rounded ${
                    signal.weight === 'high'
                      ? 'border-l-red-500 bg-red-50'
                      : signal.weight === 'medium'
                      ? 'border-l-yellow-500 bg-yellow-50'
                      : 'border-l-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{signal.signal_type}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Category {signal.signal_category} — {signal.weight} weight
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        signal.weight === 'high'
                          ? 'bg-red-200 text-red-900'
                          : signal.weight === 'medium'
                          ? 'bg-yellow-200 text-yellow-900'
                          : 'bg-blue-200 text-blue-900'
                      }`}
                    >
                      {signal.weight.toUpperCase()}
                    </span>
                  </div>

                  {signal.details && (
                    <div className="mt-2 text-xs text-gray-700 bg-white p-2 rounded">
                      {typeof signal.details === 'string'
                        ? signal.details
                        : Object.entries(signal.details)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">⚠ Disclaimer</p>
        <p>
          Cheat signals are indicators, not proof. Scores reflect behavioral patterns inconsistent
          with unassisted answers. Final judgment is always yours.
        </p>
      </div>
    </div>
  );
}
