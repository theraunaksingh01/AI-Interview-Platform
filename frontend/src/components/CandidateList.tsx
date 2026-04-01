'"'"'use client'"'"';

import { CandidateListItem } from '"'"'@/types/candidates'"'"';
import { formatDistanceToNow } from '"'"'date-fns'"'"';

interface Props {
  candidates: CandidateListItem[];
  selectedCandidate: CandidateListItem | null;
  selectedIds: string[];
  loading: boolean;
  onSelectCandidate: (id: string) => void;
  onToggleCheckbox: (id: string) => void;
  onSelectAll: () => void;
}

const getRiskColor = (risk: string | null) => {
  switch (risk) {
    case '"'"'low'"'"':
      return '"'"'bg-green-100 text-green-800'"'"';
    case '"'"'medium'"'"':
      return '"'"'bg-yellow-100 text-yellow-800'"'"';
    case '"'"'high'"'"':
      return '"'"'bg-orange-100 text-orange-800'"'"';
    case '"'"'very_high'"'"':
      return '"'"'bg-red-100 text-red-800'"'"';
    default:
      return '"'"'bg-gray-100 text-gray-800'"'"';
  }
};

const getRiskIcon = (risk: string | null) => {
  switch (risk) {
    case '"'"'low'"'"':
      return '"'"'●'"'"';
    case '"'"'medium'"'"':
      return '"'"'⚠'"'"';
    case '"'"'high'"'"':
      return '"'"'⚠'"'"';
    case '"'"'very_high'"'"':
      return '"'"'⛔'"'"';
    default:
      return '"'"'○'"'"';
  }
};

export default function CandidateList({
  candidates,
  selectedCandidate,
  selectedIds,
  loading,
  onSelectCandidate,
  onToggleCheckbox,
  onSelectAll,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading candidates...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Select All Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
        <input
          type="checkbox"
          checked={selectedIds.length === candidates.length && candidates.length > 0}
          onChange={onSelectAll}
          className="w-4 h-4"
        />
        <span className="text-sm text-gray-600">
          {selectedIds.length > 0 ? \`\${selectedIds.length} selected\` : \`\${candidates.length} candidates\`}
        </span>
      </div>

      {/* Candidate List */}
      <div className="flex-1 overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No candidates found
          </div>
        ) : (
          candidates.map((candidate) => (
            <div
              key={candidate.application_id}
              onClick={() => onSelectCandidate(candidate.application_id)}
              className={\`p-3 border-b cursor-pointer transition \${
                selectedCandidate?.application_id === candidate.application_id
                  ? '"'"'bg-blue-50 border-l-4 border-l-blue-600'"'"'
                  : '"'"'hover:bg-gray-50'"'"'
              }\`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(candidate.application_id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleCheckbox(candidate.application_id);
                  }}
                  className="w-4 h-4 mt-1"
                />

                <div className="flex-1 min-w-0">
                  {/* Name and score */}
                  <div className="flex justify-between items-baseline gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {candidate.candidate_name || '"'"'Unnamed Candidate'"'"'}
                    </h3>
                    <span className="text-lg font-bold text-gray-900 flex-shrink-0">
                      {candidate.overall_score?.toFixed(1) || '"'"'-'"'"'} / 10
                    </span>
                  </div>

                  {/* Email and time */}
                  <p className="text-sm text-gray-600 truncate mb-2">
                    {candidate.candidate_email}
                    {candidate.completed_at && (
                      <span className="ml-2">
                        • {formatDistanceToNow(new Date(candidate.completed_at), { addSuffix: true })}
                      </span>
                    )}
                  </p>

                  {/* Dimension scores */}
                  {candidate.rubric_scores && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(candidate.rubric_scores)
                        .slice(0, 3)
                        .map(([dim, score]) => (
                          <span
                            key={dim}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                          >
                            {dim.toUpperCase()} {parseFloat(score.toString()).toFixed(1)}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Cheat risk badge */}
                  {candidate.cheat_risk && (
                    <span className={\`inline-block text-xs px-2 py-1 rounded \${getRiskColor(candidate.cheat_risk)}\`}>
                      {getRiskIcon(candidate.cheat_risk)} {candidate.cheat_risk}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
