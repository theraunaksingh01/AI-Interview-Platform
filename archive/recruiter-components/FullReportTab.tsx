'use client';

import { CandidateDetail, InterviewAnswer } from '@/types/candidates';
import { useState } from 'react';

interface Props {
  candidate: CandidateDetail;
  onRescoreAnswer: (answerId: number) => void;
}

export default function FullReportTab({ candidate, onRescoreAnswer }: Props) {
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());

  const toggleExpanded = (answerId: number) => {
    const newSet = new Set(expandedAnswers);
    if (newSet.has(answerId)) {
      newSet.delete(answerId);
    } else {
      newSet.add(answerId);
    }
    setExpandedAnswers(newSet);
  };

  if (!candidate.answers || candidate.answers.length === 0) {
    return <div className="p-6 text-center text-gray-500">No answers recorded</div>;
  }

  return (
    <div className="p-6 space-y-4">
      {candidate.answers.map((answer: InterviewAnswer, idx: number) => (
        <div key={answer.id} className="border rounded-lg overflow-hidden">
          {/* Answer Header */}
          <button
            onClick={() => toggleExpanded(answer.id)}
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
          >
            <div className="flex-1 text-left">
              <h4 className="font-semibold text-gray-900">Q{idx + 1}</h4>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold">
                Score: {answer.manual_score !== null ? answer.manual_score : answer.ai_score || '—'} / 10
              </span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                (answer.manual_score !== null ? answer.manual_score : answer.ai_score || 0) >= 7
                  ? 'bg-green-100 text-green-800'
                  : (answer.manual_score !== null ? answer.manual_score : answer.ai_score || 0) >= 5
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {answer.cheat_risk || 'low'}
              </span>
              <span>{expandedAnswers.has(answer.id) ? '▼' : '▶'}</span>
            </div>
          </button>

          {/* Expanded Content */}
          {expandedAnswers.has(answer.id) && (
            <div className="px-4 py-3 border-t space-y-3">
              {/* Transcript */}
              {answer.transcript && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">Answer</h5>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                    {answer.transcript}
                  </p>
                </div>
              )}

              {/* AI Feedback */}
              {answer.ai_feedback && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">AI Feedback</h5>
                  <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                    {typeof answer.ai_feedback === 'string' ? answer.ai_feedback : JSON.stringify(answer.ai_feedback)}
                  </p>
                </div>
              )}

              {/* Test Results */}
              {answer.test_results && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">Test Results</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    {Array.isArray(answer.test_results) && answer.test_results.map((test: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span>{test.passed ? '✓' : '✗'}</span>
                        <span>{test.name || `Test ${i + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-score Button */}
              <button
                onClick={() => onRescoreAnswer(answer.id)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Re-score
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
