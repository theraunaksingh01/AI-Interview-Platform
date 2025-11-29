// File: src/app/components/ui/ModelInspector.tsx
import React from "react";

export default function ModelInspector({
  open,
  modelMeta,
  promptHash,
  promptText,
  weights,
  taskId,
  onClose,
}: {
  open: boolean;
  modelMeta?: Record<string, any> | null;
  promptHash?: string | null;
  promptText?: string | null;
  weights?: Record<string, number> | null;
  taskId?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl p-4 max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-lg">Model Inspector</h2>
          <button onClick={onClose} className="text-sm px-2 py-1 border rounded">Close</button>
        </div>

        <div className="text-sm space-y-3">
          <div><strong>Model meta</strong></div>
          <pre className="bg-gray-50 p-3 rounded text-xs">{JSON.stringify(modelMeta || {}, null, 2)}</pre>

          <div><strong>Prompt hash</strong></div>
          <div className="bg-gray-50 p-2 rounded text-xs">{promptHash || "—"}</div>

          <div><strong>Prompt text</strong></div>
          <pre className="bg-gray-50 p-3 rounded text-xs whitespace-pre-wrap">{promptText || "—"}</pre>

          <div><strong>Weights</strong></div>
          <pre className="bg-gray-50 p-3 rounded text-xs">{JSON.stringify(weights || {}, null, 2)}</pre>

          <div><strong>Task id</strong></div>
          <div className="bg-gray-50 p-2 rounded text-xs">{taskId || "—"}</div>
        </div>
      </div>
    </div>
  );
}