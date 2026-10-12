'use client';

import { CandidateDetail } from '@/types/candidates';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface FullReportTabProps {
  candidate: CandidateDetail;
}

export default function FullReportTab({ candidate }: FullReportTabProps) {
  const [expandedAnswer, setExpandedAnswer] = useState<number | null>(null);

  if (!candidate.answers || candidate.answers.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No answers recorded</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {candidate.answers.map((answer, idx) => {
        const isExpanded = expandedAnswer === idx;

        return (
          <div
            key={idx}
            className="bg-white rounded-lg shadow border border-gray-200"
          >
            {/* Answer Header */}
            <button
              onClick={() => setExpandedAnswer(isExpanded ? null : idx)}
              className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition"
            >
              <div className="text-left flex-1">
                <p className="font-semibold text-gray-900">
                  Q{(answer as any).interview_question_id}: {(answer as any).question_text || 'Interview Question'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Score: <span className="font-semibold">{(answer as any).ai_score?.toFixed(1) || (answer as any).manual_score?.toFixed(1) || '–'}/10</span>
                </p>
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Answer Details (Collapsible) */}
            {isExpanded && (
              <div className="border-t bg-gray-50 px-6 py-4 space-y-4">
                {/* Transcript */}
                {(answer as any).transcript && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Answer Transcript</h4>
                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
                      {(answer as any).transcript}
                    </p>
                  </div>
                )}

                {/* AI Feedback */}
                {(answer as any).ai_feedback && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Feedback</h4>
                    <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
                      {typeof (answer as any).ai_feedback === 'string'
                        ? (answer as any).ai_feedback
                        : JSON.stringify((answer as any).ai_feedback, null, 2)}
                    </div>
                  </div>
                )}

                {/* Test Results (for coding questions) */}
                {(answer as any).test_results && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Test Results</h4>
                    <div className="text-sm bg-white p-3 rounded border border-gray-200 space-y-1">
                      {(answer as any).test_results.map((test: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-gray-700">{test.name}</span>
                          <span className={test.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {test.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Code Answer (if applicable) */}
                {(answer as any).code_answer && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Code Submission</h4>
                    <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                      {(answer as any).code_answer}
                    </pre>
                  </div>
                )}

                {/* Cheat Signals */}
                {(answer as any).cheat_signals && (answer as any).cheat_signals.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Cheat Signals</h4>
                    <div className="space-y-2">
                      {(answer as any).cheat_signals.map((signal: any, i: number) => (
                        <div key={i} className="text-xs bg-red-50 border border-red-200 p-2 rounded">
                          <p className="font-semibold text-red-900">
                            {signal.signal_type} — {signal.weight}
                          </p>
                          <p className="text-red-800">Category {signal.signal_category}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
