'use client';

import { useState } from 'react';

interface Props {
  answerId: number;
  onClose: () => void;
  onSave: () => void;
}

export default function RescoreModal({ answerId, onClose, onSave }: Props) {
  const [score, setScore] = useState(5);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (reason.length < 20) {
      setError('Reason must be at least 20 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/company/answers/${answerId}/rescore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: parseFloat(score.toString()), reason }),
      });

      if (res.ok) {
        onSave();
      } else {
        setError('Failed to save re-score');
      }
    } catch (err) {
      setError('Error saving re-score');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Re-score Answer</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">New Score (0-10)</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={score}
            onChange={(e) => setScore(parseFloat(e.target.value))}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Reason for Override (min 20 chars)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border rounded h-24"
            placeholder="Explain why you are overriding the AI score..."
          />
          <p className="text-xs text-gray-600 mt-1">{reason.length} characters</p>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || reason.length < 20}
          >
            {loading ? 'Saving...' : 'Save Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
