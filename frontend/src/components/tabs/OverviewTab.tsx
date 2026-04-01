'use client';

import { CandidateDetail } from '@/types/candidates';
import RubricRadarChart from '@/components/RubricRadarChart';
import { useState } from 'react';

interface OverviewTabProps {
  candidate: CandidateDetail;
  onActionComplete: () => void;
}

export default function OverviewTab({ candidate, onActionComplete }: OverviewTabProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/company/candidates/${candidate.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      onActionComplete();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Radar Chart */}
      {candidate.rubric_scores && Object.keys(candidate.rubric_scores).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Dimension</h3>
          <RubricRadarChart scores={candidate.rubric_scores} />
        </div>
      )}

      {/* Cheat Risk Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cheat Risk</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-red-600">
              {candidate.cheat_score?.toFixed(0) || '–'}/100
            </p>
            <p className="text-sm text-gray-600 capitalize">
              Risk Level: {candidate.cheat_risk || 'unknown'}
            </p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>View cheat report tab for detailed signal breakdown</p>
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      {candidate.ai_recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">AI Recommendation</h3>
          <p className="text-blue-800">{candidate.ai_recommendation}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6 flex gap-3">
        <button
          onClick={() => handleAction('shortlist')}
          disabled={actionLoading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Shortlist
        </button>
        <button
          onClick={() => handleAction('advanced')}
          disabled={actionLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Advance to Next Round
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={actionLoading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
