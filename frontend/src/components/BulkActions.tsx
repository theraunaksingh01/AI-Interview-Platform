'use client';

interface Props {
  count: number;
  appIds: string[];
  onActionComplete: () => void;
}

export default function BulkActions({ count, appIds, onActionComplete }: Props) {
  const handleBulkAction = async (action: string) => {
    try {
      await fetch('/api/company/candidates/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_ids: appIds, action }),
      });
      onActionComplete();
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  };

  return (
    <div className="bg-blue-50 border-b px-6 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-gray-900">{count} selected</span>
      <div className="flex gap-2">
        <button
          onClick={() => handleBulkAction('shortlist')}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Shortlist All
        </button>
        <button
          onClick={() => handleBulkAction('reject')}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Reject All
        </button>
      </div>
    </div>
  );
}
