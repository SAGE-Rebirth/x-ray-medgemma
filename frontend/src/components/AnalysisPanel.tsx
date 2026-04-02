import React from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { UploadedImage } from '../types';

interface AnalysisPanelProps {
  image: UploadedImage | null;
  isAnalyzing: boolean;
  isComplete: boolean;
  streamedText: string;
  error: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '$1</ul>')
    .replace(/(<li>)(?![\s\S]*<\/ul>)/g, '<ul>$1')
    .replace(/^(?!<[hul\/]|$)(.+)$/gm, '<p>$1</p>')
    .replace(/<p>\s*<\/p>/g, '');
}

export default function AnalysisPanel({
  image, isAnalyzing, isComplete, streamedText, error,
}: AnalysisPanelProps) {
  const hasOutput = streamedText || error;

  return (
    <aside className="w-[420px] flex-shrink-0 bg-[#0c0c1a] border-l border-[#1e2040] flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2040] flex-shrink-0 bg-[#0c0c1a]">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500
            ${isAnalyzing
              ? 'bg-[#00d4ff] shadow-[0_0_8px_#00d4ff] animate-pulse-glow'
              : isComplete && !error
              ? 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]'
              : 'bg-[#2a2d5a]'
            }`}
          />
          <span className="text-[13px] font-semibold text-[#e8eaf6]">AI Radiology Report</span>
        </div>

        {isAnalyzing && (
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.3)] text-[#00d4ff] tracking-[1.5px]">
            ANALYZING
          </span>
        )}
        {isComplete && !isAnalyzing && !error && (
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.3)] text-[#00ff88] tracking-[1.5px]">
            COMPLETE
          </span>
        )}
        {error && (
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff4444] tracking-[1.5px]">
            ERROR
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Image metadata card */}
        {image && !hasOutput && !isAnalyzing && (
          <div className="rounded-xl bg-[#141428] border border-[#1e2040] p-4 mb-4">
            <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-[2px] mb-3">Loaded Study</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { key: 'File',       val: image.metadata.filename },
                { key: 'Size',       val: formatBytes(image.metadata.size_bytes) },
                { key: 'Dimensions', val: `${image.metadata.width} × ${image.metadata.height}` },
                { key: 'Format',     val: image.metadata.format || 'Unknown' },
              ].map(({ key, val }) => (
                <div key={key}>
                  <p className="text-[10px] font-mono text-[#4a5568] uppercase tracking-[1px] mb-0.5">{key}</p>
                  <p className="text-[12px] font-mono text-[#8892b0] truncate" title={val}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasOutput && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center min-h-[280px] gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#141428] border border-[#1e2040] flex items-center justify-center">
              <FileText size={26} className="text-[#2a2d5a]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-[14px] font-medium text-[#8892b0]">No Analysis Yet</h3>
              <p className="text-[12px] font-mono text-[#4a5568] max-w-[190px] leading-relaxed">
                {image
                  ? 'Select a tool and click Run Analysis to begin'
                  : 'Upload an image to start your analysis'}
              </p>
            </div>
          </div>
        )}

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[rgba(0,212,255,0.06)] border border-[rgba(0,212,255,0.18)] mb-4">
            <div className="flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] bounce-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] bounce-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] bounce-dot" />
            </div>
            <span className="text-[11px] font-mono text-[#00d4ff] tracking-[1.5px]">
              DR. MEDGEMMA IS ANALYZING...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex gap-3 px-4 py-3 rounded-xl bg-[rgba(255,68,68,0.07)] border border-[rgba(255,68,68,0.22)] mb-4">
            <AlertCircle size={15} className="text-[#ff4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-[#ff4444] mb-1">Analysis Error</p>
              <p className="text-[12px] text-[rgba(255,68,68,0.8)] leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Streamed analysis output */}
        {streamedText && (
          <div
            className={`analysis-output${isAnalyzing ? ' streaming-cursor' : ''}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(streamedText) }}
          />
        )}
      </div>
    </aside>
  );
}
