'use client';

import { useState, useEffect } from 'react';
import { CandidateDetail } from '@/types/candidates';
import RubricRadarChart from './RubricRadarChart';
import RescoreModal from './RescoreModal';

interface Props {
  roleId: string;
  applicationId: string;
  onActionComplete: () => void;
}

export default function CandidateDetailPanel({ roleId, applicationId, onActionComplete }: Props) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRescoreModal, setShowRescoreModal] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);

  useEffect(() => {
    fetchCandidateDetail();
  }, [applicationId]);

  const fetchCandidateDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/roles/${roleId}/candidates/${applicationId}`);
      const data = await res.json();
      setCandidate(data);
    } catch (err) {
      console.error('Failed to fetch candidate detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      await fetch(`/api/company/candidates/${applicationId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      onActionComplete();
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!candidate) {
    return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{candidate.candidate_name || 'Unknown'}</h2>
        <p className="text-gray-600">{candidate.candidate_email}</p>
        <div className="flex gap-4 mt-3">
          <span className="text-2xl font-bold">{candidate.overall_score?.toFixed(1) || '-'} / 10</span>
          {candidate.cheat_risk && <span className="text-sm px-3 py-1 rounded bg-red-100">{candidate.cheat_risk}</span>}
        </div>
      </div>

      <div className="border-b mb-4">
        <div className="flex gap-4">
          {['overview', 'full_report', 'cheat_report', 'rescore'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'full_report' && 'Full Report'}
              {tab === 'cheat_report' && 'Cheat Report'}
              {tab === 'rescore' && 'Re-score'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div>
            {candidate.rubric_scores && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Dimension Breakdown</h3>
                <RubricRadarChart scores={candidate.rubric_scores} />
              </div>
            )}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleAction('shortlist')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Shortlist
                </button>
                <button onClick={() => handleAction('advanced')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Advance
                </button>
                <button onClick={() => handleAction('reject')} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'full_report' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Answers</h3>
            <div className="space-y-4">
              {candidate.answers.map((answer, idx) => (
                <div key={answer.id} className="border p-4 rounded">
                  <div className="flex justify-between">
                    <div>
                      <h4 className="font-semibold">Q{idx + 1}</h4>
                      {answer.transcript && <p className="text-gray-600 mt-1 line-clamp-2">{answer.transcript}</p>}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAnswerId(answer.id);
                        setShowRescoreModal(true);
                      }}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Re-score
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cheat_report' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Cheat Signals</h3>
            {candidate.cheat_signals && candidate.cheat_signals.length > 0 ? (
              <div className="space-y-3">
                {candidate.cheat_signals.map((signal) => (
                  <div key={signal.id} className="border p-3 rounded bg-gray-50">
                    <span className="font-semibold">{signal.signal_type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No signals detected</p>
            )}
          </div>
        )}

        {activeTab === 'rescore' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Re-score Answers</h3>
            <div className="space-y-3">
              {candidate.answers.map((answer, idx) => (
                <div key={answer.id} className="flex justify-between items-center border p-3 rounded">
                  <p>Q{idx + 1}</p>
                  <button
                    onClick={() => {
                      setSelectedAnswerId(answer.id);
                      setShowRescoreModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Change Score
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showRescoreModal && selectedAnswerId && (
        <RescoreModal
          answerId={selectedAnswerId}
          onClose={() => {
            setShowRescoreModal(false);
            setSelectedAnswerId(null);
          }}
          onSave={() => {
            fetchCandidateDetail();
            setShowRescoreModal(false);
            onActionComplete();
          }}
        />
      )}
    </div>
  );
}
