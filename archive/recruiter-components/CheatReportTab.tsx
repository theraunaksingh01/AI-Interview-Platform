'use client';

import { CandidateDetail, CheatSignal } from '@/types/candidates';

interface Props {
  candidate: CandidateDetail;
}

const getCategoryLabel = (category: string) => {
  const map: Record<string, string> = {
    A: 'Timing Pattern',
    B: 'Content Inconsistency',
    C: 'Browser Behavior',
    D: 'Consistency Check',
  };
  return map[category] || category;
};

const getWeightColor = (weight: string) => {
  switch (weight) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function CheatReportTab({ candidate }: Props) {
  if (!candidate.cheat_signals || candidate.cheat_signals.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No cheat signals detected</p>
        <p className="text-sm text-gray-400 mt-2">Candidate cleared all anti-cheat checks</p>
      </div>
    );
  }

  // Group signals by answer
  const signalsByAnswer: Record<number, CheatSignal[]> = {};
  candidate.cheat_signals.forEach((signal: CheatSignal) => {
    if (!signalsByAnswer[signal.interview_answer_id]) {
      signalsByAnswer[signal.interview_answer_id] = [];
    }
    signalsByAnswer[signal.interview_answer_id].push(signal);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Overall Summary */}
      <div className="border rounded-lg p-4 bg-red-50 border-red-200">
        <h3 className="font-semibold text-red-900 mb-2">Overall Cheat Risk</h3>
        <p className="text-sm text-red-800">
          <strong>Score:</strong> {candidate.cheat_score || 0}/100 — <strong>{candidate.cheat_risk}</strong>
        </p>
        <p className="text-xs text-red-700 mt-3">
          ⚠ Cheat signals are indicators, not proof. Scores reflect behavioral patterns inconsistent with unassisted answers.
          Final judgment is always yours.
        </p>
      </div>

      {/* Per-Answer Signals */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Signals by Answer</h3>
        {Object.entries(signalsByAnswer).map(([answerId, signals]: [string, CheatSignal[]]) => (
          <div key={answerId} className="border rounded-lg overflow-hidden">
            {/* Answer Heading */}
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h4 className="font-semibold text-gray-900">Answer {answerId}</h4>
            </div>

            {/* Signals List */}
            <div className="divide-y">
              {signals.map((signal: CheatSignal) => (
                <div key={signal.id} className="px-4 py-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{signal.signal_type}</p>
                      <p className="text-xs text-gray-600">
                        {getCategoryLabel(signal.signal_category)} • {new Date(signal.fired_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getWeightColor(signal.weight)}`}>
                      {signal.weight.toUpperCase()}
                    </span>
                  </div>

                  {/* Signal Details */}
                  {signal.details && (
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-2">
                      {typeof signal.details === 'string'
                        ? signal.details
                        : JSON.stringify(signal.details, null, 2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
