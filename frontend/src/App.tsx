import React, { useState, useRef, useCallback } from 'react';
import Header from './components/Header';
import ToolBar from './components/ToolBar';
import XRayViewer from './components/XRayViewer';
import AnalysisPanel from './components/AnalysisPanel';
import { UploadedImage, AnalysisTool, ImageFilters } from './types';
import { useAnalysis } from './hooks/useAnalysis';
import { useAnnotations } from './hooks/useAnnotations';
import { useManualAnnotations } from './hooks/useManualAnnotations';
import { useChat } from './hooks/useChat';
import { Play, Loader2, ZoomIn, ZoomOut, Maximize2, Sun, FolderOpen, Tag, Eye, EyeOff, Pen } from 'lucide-react';

const TOOL_LABELS: Record<AnalysisTool, string> = {
  full:        'Full Analysis',
  bone:        'Bone Analysis',
  soft_tissue: 'Soft Tissue',
  pathology:   'Pathology Hunt',
  cardiac:     'Cardiopulmonary',
  compare:     'Reference Guide',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const BASE_BTN =
  'flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] font-mono border border-[#1e2040] text-[#8892b0] hover:bg-[#141428] hover:text-[#e8eaf6] hover:border-[#2a2d5a] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';

const MOBILE_TOOLS: { id: AnalysisTool; icon: string; label: string }[] = [
  { id: 'full',        icon: '🔬', label: 'Full' },
  { id: 'bone',        icon: '🦴', label: 'Bone' },
  { id: 'soft_tissue', icon: '🫁', label: 'Tissue' },
  { id: 'pathology',   icon: '⚠️', label: 'Path' },
  { id: 'cardiac',     icon: '❤️', label: 'Cardiac' },
  { id: 'compare',     icon: '📋', label: 'Guide' },
];

export default function App() {
  const [image, setImage]           = useState<UploadedImage | null>(null);
  const [selectedTool, setTool]     = useState<AnalysisTool>('full');
  const [filters, setFilters]       = useState<ImageFilters>({ brightness: 100, contrast: 100, invert: false, zoom: 100 });
  const [uploading, setUploading]   = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isDrawing, setIsDrawing]   = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isAnalyzing, streamedText, isComplete, error, startAnalysis, reset } = useAnalysis();
  const { annotations, isLoading: isLabeling, fetchAnnotations, clearAnnotations } = useAnnotations();
  const { manualAnnotations, addAnnotation, removeAnnotation, clearManualAnnotations } = useManualAnnotations();
  const { messages: chatMessages, isStreaming: isChatStreaming, sendMessage: sendChat, clearChat } = useChat();

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    reset();
    clearAnnotations();
    clearManualAnnotations();
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const uploadedImage = { ...data, preview_url: URL.createObjectURL(file) };
      setImage(uploadedImage);
      setFilters({ brightness: 100, contrast: 100, invert: false, zoom: 100 });
      setIsDrawing(true);
      // Auto-fetch annotations
      setTimeout(() => {
        fetchAnnotations(uploadedImage);
      }, 100);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [reset, clearAnnotations, clearManualAnnotations, fetchAnnotations]);

  const handleAnalyze = useCallback(() => {
    if (image && !isAnalyzing) startAnalysis(image, selectedTool);
  }, [image, isAnalyzing, selectedTool, startAnalysis]);

  const handleClear = useCallback(() => {
    if (image?.preview_url) URL.revokeObjectURL(image.preview_url);
    setImage(null);
    reset();
    clearAnnotations();
    clearManualAnnotations();
    clearChat();
    setFilters({ brightness: 100, contrast: 100, invert: false, zoom: 100 });
  }, [image, reset, clearAnnotations, clearManualAnnotations, clearChat]);

  const handleAutoLabel = useCallback(() => {
    if (image && !isLabeling) fetchAnnotations(image);
  }, [image, isLabeling, fetchAnnotations]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080810] text-[#e8eaf6] font-sans">
      <Header imageLoaded={!!image} filename={image?.metadata.filename} />

      {isAnalyzing && <div className="scan-bar" />}

      {/* Mobile / tablet tool selector strip (hidden on lg+) */}
      <div className="lg:hidden flex-shrink-0 bg-[#0c0c1a] border-b border-[#1e2040] overflow-x-auto">
        <div className="flex gap-1 px-3 py-2 min-w-max">
          {MOBILE_TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap flex-shrink-0 border transition-all duration-150
                ${selectedTool === tool.id
                  ? 'bg-[rgba(0,212,255,0.1)] border-[#00d4ff] text-[#00d4ff]'
                  : 'border-[#1e2040] text-[#8892b0] hover:bg-[#141428] hover:text-[#e8eaf6]'
                }`}
            >
              <span className="text-sm leading-none">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <ToolBar
          selectedTool={selectedTool}
          onSelectTool={setTool}
          filters={filters}
          onFilterChange={setFilters}
          image={image}
          onOpenFile={() => fileInputRef.current?.click()}
          onClear={handleClear}
        />

        {/* Center viewer */}
        <main className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#050508]">
          {/* Viewer toolbar — horizontally scrollable on mobile */}
          <div className="flex items-center gap-1.5 px-2 sm:px-4 py-2 bg-[#0c0c1a] border-b border-[#1e2040] flex-shrink-0 overflow-x-auto scrollbar-hide">

            {/* Run analysis */}
            <button
              disabled={!image || isAnalyzing}
              onClick={handleAnalyze}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-mono flex-shrink-0
                bg-gradient-to-r from-[rgba(0,80,255,0.12)] to-[rgba(0,212,255,0.12)]
                border border-[#00d4ff] text-[#00d4ff]
                hover:from-[rgba(0,80,255,0.22)] hover:to-[rgba(0,212,255,0.22)]
                hover:shadow-[0_0_20px_rgba(0,212,255,0.18)]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
                transition-all duration-150"
            >
              {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {isAnalyzing ? 'Analyzing...' : `Run ${TOOL_LABELS[selectedTool]}`}
            </button>

            <div className="w-px h-4 bg-[#1e2040] mx-1 flex-shrink-0" />

            {/* Auto label / segmentation - now shows status */}
            <button
              disabled={!image || isLabeling}
              onClick={handleAutoLabel}
              title="Re-fetch annotations from image"
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] font-mono border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0
                ${annotations.length > 0
                  ? 'border-[#00ff88] text-[#00ff88] bg-[rgba(0,255,136,0.07)] hover:bg-[rgba(0,255,136,0.13)]'
                  : 'border-[#1e2040] text-[#8892b0] hover:bg-[#141428] hover:text-[#e8eaf6] hover:border-[#2a2d5a]'
                }`}
            >
              {isLabeling ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
              {isLabeling
                ? 'Labeling...'
                : annotations.length > 0
                ? `Labels (${annotations.length})`
                : 'Auto Label'}
            </button>

            {/* Manual drawing mode */}
            <button
              disabled={!image}
              onClick={() => setIsDrawing(v => !v)}
              title={isDrawing ? 'Exit drawing mode (ESC)' : 'Enable manual labelling'}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] font-mono border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0
                ${isDrawing
                  ? 'border-[#ff9900] text-[#ff9900] bg-[rgba(255,153,0,0.1)] hover:bg-[rgba(255,153,0,0.15)] shadow-[0_0_12px_rgba(255,153,0,0.2)]'
                  : 'border-[#1e2040] text-[#8892b0] hover:bg-[#141428] hover:text-[#e8eaf6] hover:border-[#2a2d5a]'
                }`}
            >
              <Pen size={12} />
              {isDrawing ? 'Draw On' : 'Draw Off'}
            </button>

            {/* Toggle annotation visibility */}
            {(annotations.length > 0 || manualAnnotations.length > 0) && (
              <button
                onClick={() => setShowAnnotations(v => !v)}
                title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
                className={`${BASE_BTN} ${showAnnotations ? '!border-[#00ff88] !text-[#00ff88] !bg-[rgba(0,255,136,0.07)]' : ''}`}
              >
                {showAnnotations ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            )}

            <div className="w-px h-4 bg-[#1e2040] mx-1 flex-shrink-0" />

            {/* Zoom controls */}
            <button className={BASE_BTN} onClick={() => setFilters(f => ({ ...f, zoom: Math.min(f.zoom + 25, 400) }))} title="Zoom In">
              <ZoomIn size={12} /> In
            </button>
            <button className={BASE_BTN} onClick={() => setFilters(f => ({ ...f, zoom: Math.max(f.zoom - 25, 25) }))} title="Zoom Out">
              <ZoomOut size={12} /> Out
            </button>
            <button className={BASE_BTN} onClick={() => setFilters(f => ({ ...f, zoom: 100 }))} title="Fit to view">
              <Maximize2 size={12} /> Fit
            </button>

            <div className="w-px h-4 bg-[#1e2040] mx-1 flex-shrink-0" />

            <button
              title="Toggle invert"
              onClick={() => setFilters(f => ({ ...f, invert: !f.invert }))}
              className={`${BASE_BTN} ${filters.invert ? '!border-[#00d4ff] !text-[#00d4ff] !bg-[rgba(0,212,255,0.08)]' : ''}`}
            >
              <Sun size={12} />
              {filters.invert ? 'Normal' : 'Invert'}
            </button>

            <button className={BASE_BTN} onClick={() => fileInputRef.current?.click()} title="Open image">
              <FolderOpen size={12} /> Open
            </button>

            {/* Image metadata — hidden on small screens */}
            {image && (
              <div className="hidden sm:flex ml-auto items-center gap-2 text-[11px] font-mono text-[#4a5568] flex-shrink-0">
                <span>{image.metadata.width}×{image.metadata.height}px</span>
                <span className="text-[#1e2040]">│</span>
                <span>{formatBytes(image.metadata.size_bytes)}</span>
                <span className="text-[#1e2040]">│</span>
                <span>{image.metadata.format}</span>
                <span className="text-[#1e2040]">│</span>
                <span className="text-[#00d4ff]">{filters.zoom}%</span>
              </div>
            )}
          </div>

          <XRayViewer
            image={image}
            filters={filters}
            uploading={uploading}
            onFile={handleFile}
            annotations={annotations}
            showAnnotations={showAnnotations}
            isDrawing={isDrawing}
            onToggleDrawing={setIsDrawing}
            onAddAnnotation={addAnnotation}
            manualAnnotations={manualAnnotations}
            onRemoveAnnotation={removeAnnotation}
          />
        </main>

        <AnalysisPanel
          image={image}
          isAnalyzing={isAnalyzing}
          isComplete={isComplete}
          streamedText={streamedText}
          error={error}
          chatMessages={chatMessages}
          isChatStreaming={isChatStreaming}
          onSendChat={(msg) => {
            if (image) sendChat(msg, image.image_data, image.mime_type, streamedText);
          }}
          onClearChat={clearChat}
          mobileCollapsed={panelCollapsed}
          onToggleMobileCollapse={() => setPanelCollapsed(v => !v)}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.dcm"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
