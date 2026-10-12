'use client';

import { CandidateDetail, InterviewAnswer } from '@/types/candidates';
import { useState } from 'react';

interface Props {
  candidate: CandidateDetail;
  onRescoreAnswer: (answerId: number) => void;
}

export default function RescoreTab({ candidate, onRescoreAnswer }: Props) {
  const [expandedAnswerId, setExpandedAnswerId] = useState<number | null>(null);

  if (!candidate.answers || candidate.answers.length === 0) {
    return <div className="p-6 text-center text-gray-500">No answers to re-score</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-900">
          <strong>How to use:</strong> Click any answer below to review and optionally change the score. You must provide
          a reason (min. 20 characters) for overriding the AI score.
        </p>
      </div>

      {candidate.answers.map((answer: InterviewAnswer, idx: number) => (
        <div key={answer.id} className="border rounded-lg overflow-hidden">
          {/* Row: Closed State */}
          {expandedAnswerId !== answer.id ? (
            <button
              onClick={() => setExpandedAnswerId(answer.id)}
              className="w-full px-4 py-3 bg-white hover:bg-gray-50 flex justify-between items-center"
            >
              <div className="text-left">
                <h4 className="font-semibold text-gray-900">Q{idx + 1}</h4>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">
                  Current: {answer.manual_score !== null ? answer.manual_score : answer.ai_score || '—'} / 10
                </span>
                <span className="text-gray-400">▶</span>
              </div>
            </button>
          ) : (
            // Expanded State
            <div className="p-4 space-y-3">
              <button
                onClick={() => setExpandedAnswerId(null)}
                className="w-full text-left font-semibold text-gray-900 flex justify-between items-center mb-2"
              >
                <span>Q{idx + 1}</span>
                <span className="text-gray-400">▼</span>
              </button>

              {/* Original Score */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Original AI Score</label>
                <div className="px-3 py-2 bg-gray-100 rounded text-sm font-semibold text-gray-900">
                  {answer.ai_score || '—'} / 10
                </div>
              </div>

              {/* Current Score Info */}
              {answer.manual_score !== null && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Current Manual Score</label>
                  <div className="px-3 py-2 bg-blue-50 rounded text-sm font-semibold text-blue-900">
                    {answer.manual_score} / 10 (overridden)
                  </div>
                </div>
              )}

              {/* Re-score Button */}
              <button
                onClick={() => onRescoreAnswer(answer.id)}
                className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              >
                Open Re-score Modal
              </button>

              {/* Answer Transcript Preview */}
              {answer.transcript && (
                <div className="mt-3 pt-3 border-t">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Answer Preview</label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                    {answer.transcript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
