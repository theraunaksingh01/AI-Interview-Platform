'use client';

import { CandidateDetail } from '@/types/candidates';
import RubricRadarChart from './RubricRadarChart';

interface Props {
  candidate: CandidateDetail;
}

export default function OverviewTab({ candidate }: Props) {
  return (
    <div className="p-6 space-y-6">
      {/* Radar Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
        {candidate.rubric_scores ? (
          <RubricRadarChart scores={candidate.rubric_scores} />
        ) : (
          <p className="text-gray-500 text-center py-8">No rubric scores available</p>
        )}
      </div>

      {/* Cheat Summary */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Cheat Assessment</h3>
        <div className="space-y-2">
          <p className="text-sm">
            <strong>Overall Risk:</strong>{' '}
            <span
              className={`px-3 py-1 rounded text-sm font-semibold ${
                candidate.cheat_risk === 'very_high'
                  ? 'bg-red-100 text-red-800'
                  : candidate.cheat_risk === 'high'
                  ? 'bg-orange-100 text-orange-800'
                  : candidate.cheat_risk === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {candidate.cheat_risk || 'Unknown'}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            {candidate.cheat_score
              ? `Cheat Score: ${candidate.cheat_score}/100`
              : 'No cheat signals detected'}
          </p>
        </div>
      </div>

      {/* AI Recommendation */}
      {candidate.ai_recommendation && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Recommendation</h3>
          <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">{candidate.ai_recommendation}</p>
        </div>
      )}

      {/* Overall Score */}
      <div className="border-t pt-6 flex justify-between items-center">
        <span className="text-lg font-semibold">Overall Score</span>
        <span className="text-4xl font-bold text-blue-600">
          {candidate.overall_score?.toFixed(1) || '—'} / 10
        </span>
      </div>
    </div>
  );
}
