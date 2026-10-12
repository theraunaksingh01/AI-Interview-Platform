'use client';

import { CandidateListItem } from '@/types/candidates';

interface CandidateCompareProps {
  candidates: CandidateListItem[];
  onClose: () => void;
  onAction: (appId: string, action: string) => void;
}

export default function CandidateCompare({
  candidates,
  onClose,
  onAction,
}: CandidateCompareProps) {
  if (candidates.length < 2 || candidates.length > 4) {
    return null;
  }

  // Get all unique dimension keys
  const dimensionKeys = new Set<string>();
  candidates.forEach(c => {
    if (c.rubric_scores) {
      Object.keys(c.rubric_scores).forEach(k => dimensionKeys.add(k));
    }
  });

  const dimensions = Array.from(dimensionKeys).sort();

  const getCellColor = (value: number, allValues: number[]) => {
    const max = Math.max(...allValues);
    if (value === max) return 'bg-green-100';
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-50 border-b px-6 py-4 sticky top-0">
          <h2 className="text-xl font-bold text-gray-900">Candidate Comparison</h2>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 w-24">
                  Metric
                </th>
                {candidates.map((c, idx) => (
                  <th key={idx} className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                    {c.candidate_name || `Candidate ${idx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Overall Score */}
              <tr className="bg-blue-50 border-b-2">
                <td className="px-6 py-3 font-semibold text-gray-900">Overall</td>
                {candidates.map((c, idx) => (
                  <td
                    key={idx}
                    className={`px-6 py-3 text-center font-bold text-lg ${getCellColor(
                      c.overall_score || 0,
                      candidates.map(x => x.overall_score || 0)
                    )}`}
                  >
                    {c.overall_score?.toFixed(1) || '–'}
                  </td>
                ))}
              </tr>

              {/* Dimension Scores */}
              {dimensions.map(dim => (
                <tr key={dim}>
                  <td className="px-6 py-3 font-medium text-gray-900 capitalize">{dim}</td>
                  {candidates.map((c, idx) => {
                    const score = c.rubric_scores?.[dim] || 0;
                    const allScores = candidates.map(x => x.rubric_scores?.[dim] || 0);
                    return (
                      <td
                        key={idx}
                        className={`px-6 py-3 text-center font-semibold ${getCellColor(score, allScores)}`}
                      >
                        {Number(score).toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Cheat Risk */}
              <tr className="bg-red-50">
                <td className="px-6 py-3 font-semibold text-gray-900">Cheat Risk</td>
                {candidates.map((c, idx) => (
                  <td key={idx} className="px-6 py-3 text-center capitalize text-sm font-semibold">
                    {c.cheat_risk || '–'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
          >
            Close
          </button>
          {candidates.map((c, idx) => (
            <button
              key={idx}
              onClick={() => onAction(c.application_id, 'shortlist')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Shortlist {c.candidate_name || `#${idx + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
