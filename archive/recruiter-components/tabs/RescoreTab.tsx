'use client';

import { CandidateDetail } from '@/types/candidates';
import RescoreModal from '@/components/RescoreModal';
import { useState } from 'react';

interface RescoreTabProps {
  candidate: CandidateDetail;
  onRescoreComplete: () => void;
}

export default function RescoreTab({ candidate, onRescoreComplete }: RescoreTabProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);

  if (!candidate.answers || candidate.answers.length === 0) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No answers to rescore</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {candidate.answers.map((answer, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
          >
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                Q{(answer as any).interview_question_id}
              </p>
              <p className="text-sm text-gray-600">
                Current Score: {(answer as any).ai_score?.toFixed(1) || (answer as any).manual_score?.toFixed(1) || '–'}/10
              </p>
            </div>
            <button
              onClick={() => setSelectedAnswerId((answer as any).id)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Re-score
            </button>
          </div>
        ))}
      </div>

      {/* Rescore Modal */}
      {selectedAnswerId && (
        <RescoreModal
          answerId={selectedAnswerId}
          currentScore={
            (candidate.answers.find(a => (a as any).id === selectedAnswerId) as any)?.ai_score ||
            (candidate.answers.find(a => (a as any).id === selectedAnswerId) as any)?.manual_score ||
            0
          }
          onClose={() => setSelectedAnswerId(null)}
          onSuccess={() => {
            setSelectedAnswerId(null);
            onRescoreComplete();
          }}
        />
      )}
    </div>
  );
}
