import React from 'react';
import { FolderOpen, Trash2, RotateCcw } from 'lucide-react';
import { AnalysisTool, ImageFilters, UploadedImage } from '../types';

const TOOLS: { id: AnalysisTool; label: string; icon: string; desc: string }[] = [
  { id: 'full',       label: 'Full Analysis',   icon: '🔬', desc: 'Comprehensive radiological report' },
  { id: 'bone',       label: 'Bone Analysis',   icon: '🦴', desc: 'Osseous structures focus' },
  { id: 'soft_tissue',label: 'Soft Tissue',     icon: '🫁', desc: 'Soft tissue evaluation' },
  { id: 'pathology',  label: 'Pathology Hunt',  icon: '⚠️', desc: 'Active pathology detection' },
  { id: 'cardiac',    label: 'Cardiopulmonary', icon: '❤️', desc: 'Heart & lung assessment' },
  { id: 'compare',    label: 'Reference Guide', icon: '📋', desc: 'Normal vs abnormal guide' },
];

interface ToolBarProps {
  selectedTool: AnalysisTool;
  onSelectTool: (tool: AnalysisTool) => void;
  filters: ImageFilters;
  onFilterChange: (f: ImageFilters) => void;
  image: UploadedImage | null;
  onOpenFile: () => void;
  onClear: () => void;
}

export default function ToolBar({
  selectedTool, onSelectTool, filters, onFilterChange, image, onOpenFile, onClear,
}: ToolBarProps) {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-[#0c0c1a] border-r border-[#1e2040] flex flex-col overflow-y-auto">
      {/* Analysis Tools */}
      <div className="p-4 border-b border-[#1e2040]">
        <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-[2px] mb-3">Analysis Tools</p>
        <div className="space-y-0.5">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              title={tool.desc}
              onClick={() => onSelectTool(tool.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-left transition-all duration-150 font-medium
                ${selectedTool === tool.id
                  ? 'bg-[rgba(0,212,255,0.1)] border border-[#00d4ff] text-[#00d4ff]'
                  : 'border border-transparent text-[#8892b0] hover:bg-[#141428] hover:text-[#e8eaf6] hover:border-[#1e2040]'
                }`}
            >
              <span className="text-base w-5 text-center leading-none">{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Image Controls */}
      <div className="p-4 border-b border-[#1e2040]">
        <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-[2px] mb-3">Image Controls</p>

        <SliderControl label="Brightness" value={filters.brightness} min={0}  max={300} onChange={v => onFilterChange({ ...filters, brightness: v })} />
        <SliderControl label="Contrast"   value={filters.contrast}   min={0}  max={500} onChange={v => onFilterChange({ ...filters, contrast:   v })} />
        <SliderControl label="Zoom"       value={filters.zoom}       min={25} max={400} onChange={v => onFilterChange({ ...filters, zoom:       v })} />

        {/* Invert toggle */}
        <button
          onClick={() => onFilterChange({ ...filters, invert: !filters.invert })}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-[12px] font-mono transition-all duration-150 mb-2
            ${filters.invert
              ? 'border border-[#00d4ff] text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
              : 'border border-[#1e2040] text-[#8892b0] bg-[#141428] hover:border-[#2a2d5a] hover:text-[#e8eaf6]'
            }`}
        >
          <span>Invert (Negative)</span>
          <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-200 flex-shrink-0 ${filters.invert ? 'bg-[#0099bb]' : 'bg-[#2a2d5a]'}`}>
            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-200 ${filters.invert ? 'left-[14px] bg-[#00d4ff]' : 'left-0.5 bg-[#4a5568]'}`} />
          </div>
        </button>

        <button
          onClick={() => onFilterChange({ brightness: 100, contrast: 100, invert: false, zoom: 100 })}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[11px] font-mono text-[#4a5568] border border-[#1e2040] rounded-lg hover:border-[#2a2d5a] hover:text-[#8892b0] transition-all duration-150"
        >
          <RotateCcw size={10} />
          Reset Filters
        </button>
      </div>

      {/* Actions */}
      <div className="p-4">
        <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-[2px] mb-3">Actions</p>
        <div className="space-y-0.5">
          <button
            onClick={onOpenFile}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-left border border-[#00d4ff] text-[#00d4ff] bg-[rgba(0,212,255,0.05)] hover:bg-[rgba(0,212,255,0.12)] transition-all duration-150"
          >
            <FolderOpen size={15} />
            {image ? 'Load New Image' : 'Open Image'}
          </button>
          {image && (
            <button
              onClick={onClear}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-left border border-transparent text-[#8892b0] hover:bg-[#141428] hover:text-[#ff4444] hover:border-[rgba(255,68,68,0.25)] transition-all duration-150"
            >
              <Trash2 size={14} />
              Clear Workspace
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function SliderControl({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[11px] font-mono text-[#8892b0]">{label}</span>
        <span className="text-[11px] font-mono text-[#00d4ff]">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        className="range-slider"
        onChange={e => onChange(+e.target.value)}
      />
    </div>
  );
}
