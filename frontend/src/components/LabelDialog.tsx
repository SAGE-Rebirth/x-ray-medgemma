import React, { useState } from 'react';
import { X } from 'lucide-react';

interface LabelDialogProps {
  isOpen: boolean;
  onSelect: (type: 'anatomy' | 'pathology' | 'device', label: string) => void;
  onCancel: () => void;
}

const ANNOTATION_TYPES = [
  { id: 'pathology', label: 'Defective Area', color: '#ff4422', desc: 'Mark defective/abnormal finding' },
] as const;

export default function LabelDialog({ isOpen, onSelect, onCancel }: LabelDialogProps) {
  const [label, setLabel] = useState('');

  const handleSubmit = () => {
    if (label.trim()) {
      onSelect('pathology', label.trim());
      setLabel('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <div className="bg-[#0c0c1a] border border-[#1e2040] rounded-xl shadow-2xl w-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2040] bg-[#141428]">
          <h2 className="text-base font-mono font-semibold text-[#e8eaf6]">Mark Defective Area</h2>
          <button
            onClick={onCancel}
            className="text-[#8892b0] hover:text-[#e8eaf6] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Type badge */}
          <div>
            <label className="block text-[11px] font-mono text-[#4a5568] uppercase tracking-[1.5px] mb-2">
              Type
            </label>
            <div className="px-3 py-2 rounded-lg bg-[rgba(255,68,34,0.15)] border border-[#ff4422] text-[#ff4422] text-[12px] font-mono">
              ⚠️ Defective Area
            </div>
          </div>

          {/* Label Input */}
          <div>
            <label className="block text-[11px] font-mono text-[#4a5568] uppercase tracking-[1.5px] mb-2">
              Description
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Nodule in upper lobe, Fracture line, Mass"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-[#141428] border border-[#1e2040] text-[#e8eaf6] text-[13px] font-mono
                placeholder-[#4a5568] focus:outline-none focus:border-[#ff4422] focus:ring-1 focus:ring-[rgba(255,68,34,0.3)]
                transition-all duration-150"
            />
          </div>

          {/* Info text */}
          <p className="text-[10px] text-[#4a5568] font-mono">
            Press <code className="bg-[#141428] px-1.5 py-0.5 rounded">Enter</code> to save or <code className="bg-[#141428] px-1.5 py-0.5 rounded">Esc</code> to cancel
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#1e2040] bg-[#141428]">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg text-[12px] font-mono border border-[#1e2040] text-[#8892b0]
              hover:border-[#2a2d5a] hover:text-[#e8eaf6] hover:bg-[#0c0c1a] transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!label.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-[12px] font-mono border border-[#ff4422] text-[#ff4422]
              bg-[rgba(255,68,34,0.1)] hover:bg-[rgba(255,68,34,0.15)] disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150"
          >
            Mark Defect
          </button>
        </div>
      </div>
    </div>
  );
}
