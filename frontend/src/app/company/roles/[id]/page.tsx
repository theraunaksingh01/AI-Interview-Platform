'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CandidateList from '@/components/CandidateList';
import CandidateDetailPanel from '@/components/CandidateDetailPanel';
import BulkActions from '@/components/BulkActions';
import { CandidateListItem } from '@/types/candidates';

export default function RoleDashboard() {
  const params = useParams();
  const roleId = params.id as string;

  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    cheatRisk: 'all',
    minScore: 0,
  });
  const [sortBy, setSortBy] = useState('score');

  useEffect(() => {
    fetchCandidates();
  }, [roleId, filters, sortBy]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.cheatRisk !== 'all') params.append('cheat_risk', filters.cheatRisk);
      if (filters.minScore > 0) params.append('min_score', filters.minScore.toString());
      params.append('sort_by', sortBy);

      const res = await fetch(`/api/company/roles/${roleId}/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.items || []);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = (id: string) => {
    setSelectedCandidate(
      candidates.find(c => c.application_id === id) || null
    );
  };

  const handleToggleCheckbox = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.application_id));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              + Invite Candidates
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
              Export CSV
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
              View Analytics
            </button>
          </div>
        </div>

        {/* Filters & Sort */}
        <div className="flex gap-4 items-center">
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="all">All Status</option>
            <option value="invited">Invited</option>
            <option value="completed">Completed</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filters.cheatRisk}
            onChange={e => setFilters({ ...filters, cheatRisk: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="all">All Risk</option>
            <option value="low">Low Only</option>
            <option value="high">High+</option>
          </select>

          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={filters.minScore}
            onChange={e => setFilters({ ...filters, minScore: parseFloat(e.target.value) })}
            className="w-32"
          />
          <span className="text-sm text-gray-600">Score ≥ {filters.minScore.toFixed(1)}</span>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded ml-auto"
          >
            <option value="score">Sort: Score</option>
            <option value="date">Sort: Date</option>
            <option value="cheat_risk">Sort: Cheat Risk</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <BulkActions
          count={selectedIds.length}
          appIds={selectedIds}
          onActionComplete={() => {
            setSelectedIds([]);
            fetchCandidates();
          }}
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Candidate List */}
        <div className="w-96 border-r bg-white overflow-y-auto">
          <CandidateList
            candidates={candidates}
            selectedCandidate={selectedCandidate}
            selectedIds={selectedIds}
            loading={loading}
            onSelectCandidate={handleSelectCandidate}
            onToggleCheckbox={handleToggleCheckbox}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          {selectedCandidate ? (
            <CandidateDetailPanel
              roleId={roleId}
              applicationId={selectedCandidate.application_id}
              onActionComplete={() => fetchCandidates()}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a candidate to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
