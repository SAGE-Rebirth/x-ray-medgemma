import React, { useRef, useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

interface ImageUploaderProps {
  onFile: (file: File) => void;
  uploading: boolean;
}

export default function ImageUploader({ onFile, uploading }: ImageUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      className={`flex flex-col items-center justify-center w-full h-full gap-5 transition-all duration-300 ${dragging ? 'bg-[rgba(0,212,255,0.03)]' : ''}`}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{ cursor: uploading ? 'default' : 'pointer' }}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-4 text-[#00d4ff] font-mono">
          <div className="flex gap-1.5 items-center">
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] bounce-dot" />
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] bounce-dot" />
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] bounce-dot" />
          </div>
          <span className="text-[12px] tracking-[2px]">LOADING IMAGE...</span>
        </div>
      ) : (
        <>
          {/* Drop circle */}
          <div className={`w-28 h-28 rounded-full border-2 border-dashed flex items-center justify-center transition-all duration-300
            ${dragging
              ? 'border-[#00d4ff] shadow-[0_0_48px_rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)]'
              : 'border-[#2a2d5a] hover:border-[#00d4ff] hover:shadow-[0_0_40px_rgba(0,212,255,0.12)]'
            }`}>
            <span className="text-4xl" style={{ opacity: dragging ? 0.9 : 0.45 }}>🩻</span>
          </div>

          {/* Text */}
          <div className="text-center space-y-2">
            <h3 className="text-[15px] font-medium text-[#8892b0]">Drop X-Ray Image Here</h3>
            <p className="text-[12px] font-mono text-[#4a5568] leading-relaxed">
              or click to browse files<br />
              PNG · JPG · TIFF · BMP · WEBP
            </p>
          </div>

          {/* CTA hint */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#1e2040] bg-[#141428]">
            <Upload size={11} className="text-[#4a5568]" />
            <span className="text-[11px] font-mono text-[#4a5568]">Select file to begin analysis</span>
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,.dcm"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
