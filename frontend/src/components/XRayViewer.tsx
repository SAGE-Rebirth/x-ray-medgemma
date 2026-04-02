import React, { useRef, useState, useCallback, useEffect } from 'react';
import { UploadedImage, ImageFilters, Annotation } from '../types';
import ImageUploader from './ImageUploader';
import LabelDialog from './LabelDialog';

interface XRayViewerProps {
  image: UploadedImage | null;
  filters: ImageFilters;
  uploading: boolean;
  onFile: (file: File) => void;
  annotations: Annotation[];
  showAnnotations: boolean;
  isDrawing: boolean;
  onToggleDrawing: (enabled: boolean) => void;
  onAddAnnotation: (annotation: Annotation) => void;
  manualAnnotations: Annotation[];
  onRemoveAnnotation: (index: number) => void;
}

/* ── Color map ─────────────────────────────────────────── */
const TYPE_COLOR: Record<Annotation['type'], string> = {
  anatomy:   '#00d4ff',
  pathology: '#ff4422',
  device:    '#ffbb00',
};
const TYPE_FILL_OPACITY: Record<Annotation['type'], number> = {
  anatomy:   0.07,
  pathology: 0.13,
  device:    0.09,
};

/* ── Single annotation box (corner-bracket style) ────── */
function AnnotationBox({ ann, isManual, onRemove }: { ann: Annotation; isManual?: boolean; onRemove?: () => void }) {
  const [y1, x1, y2, x2] = ann.box_2d;
  const w = x2 - x1;
  const h = y2 - y1;

  const color        = TYPE_COLOR[ann.type] ?? '#00d4ff';
  const fillOpacity  = TYPE_FILL_OPACITY[ann.type] ?? 0.07;
  const bracketLen   = Math.max(14, Math.min(w, h) * 0.2);

  // Label sits above the box when there's room, otherwise below
  const LABEL_H   = 17;
  const rawLabel  = ann.label.toUpperCase();
  const labelW    = Math.min(rawLabel.length, 28) * 6.2 + 12;
  const labelY    = y1 >= LABEL_H + 4 ? y1 - LABEL_H - 2 : y2 + 2;
  const labelText = rawLabel.length > 28 ? rawLabel.slice(0, 25) + '...' : rawLabel;

  return (
    <g>
      {/* Semi-transparent region fill */}
      <rect x={x1} y={y1} width={w} height={h} fill={color} fillOpacity={fillOpacity} />

      {/* Corner brackets — top-left */}
      <path d={`M${x1} ${y1 + bracketLen} L${x1} ${y1} L${x1 + bracketLen} ${y1}`}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* top-right */}
      <path d={`M${x2 - bracketLen} ${y1} L${x2} ${y1} L${x2} ${y1 + bracketLen}`}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* bottom-left */}
      <path d={`M${x1} ${y2 - bracketLen} L${x1} ${y2} L${x1 + bracketLen} ${y2}`}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* bottom-right */}
      <path d={`M${x2 - bracketLen} ${y2} L${x2} ${y2} L${x2} ${y2 - bracketLen}`}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Label badge */}
      <rect x={x1} y={labelY} width={labelW} height={LABEL_H} fill={color} rx="2" opacity="0.93" />
      <text
        x={x1 + 5}
        y={labelY + LABEL_H - 4}
        fill="#fff"
        fontSize="10"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        letterSpacing="0.05em"
      >
        {labelText}
      </text>

      {/* Remove button for manual annotations */}
      {isManual && onRemove && (
        <g onClick={onRemove} style={{ cursor: 'pointer' }}>
          <circle cx={x2} cy={y1} r="12" fill="#ff4422" opacity="0.9" />
          <text
            x={x2}
            y={y1 + 4}
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
}

/* ── Bottom-left legend ──────────────────────────────── */
const LEGEND_TYPES = [
  { type: 'pathology', label: 'Defective Area' },
] as const;

/* ── Main component ─────────────────────────────────── */
export default function XRayViewer({
  image, filters, uploading, onFile, annotations, showAnnotations, isDrawing, onToggleDrawing, onAddAnnotation, manualAnnotations, onRemoveAnnotation,
}: XRayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [rendered, setRendered] = useState<{ w: number; h: number } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingBox, setPendingBox] = useState<[number, number, number, number] | null>(null);
  const [showLabelDialog, setShowLabelDialog] = useState(false);

  /** Calculate the CSS-rendered size of the img element */
  const calcSize = useCallback(() => {
    if (!imgRef.current) return;
    const { clientWidth: w, clientHeight: h } = imgRef.current;
    if (w && h) setRendered({ w, h });
  }, []);

  /** Convert mouse event coordinates to SVG viewport coordinates (0-1000) */
  const getViewBoxCoords = useCallback((e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Map to viewBox coordinates (0-1000)
    const viewBoxX = (x / rect.width) * 1000;
    const viewBoxY = (y / rect.height) * 1000;
    
    return { x: viewBoxX, y: viewBoxY };
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !rendered) return;
    
    const coords = getViewBoxCoords(e);
    if (!coords) return;
    
    setDrawing(true);
    setStartPos(coords);
    setCurrentRect(null);
  }, [isDrawing, rendered, getViewBoxCoords]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing || !startPos || !rendered) return;
    
    const coords = getViewBoxCoords(e);
    if (!coords) return;
    
    const w = coords.x - startPos.x;
    const h = coords.y - startPos.y;
    
    setCurrentRect({
      x: w >= 0 ? startPos.x : coords.x,
      y: h >= 0 ? startPos.y : coords.y,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  }, [drawing, startPos, rendered, getViewBoxCoords]);

  const handleSvgMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing || !currentRect) {
      setDrawing(false);
      setStartPos(null);
      setCurrentRect(null);
      return;
    }
    
    if (currentRect.w > 20 && currentRect.h > 20) {
      // Convert to box_2d format [y_min, x_min, y_max, x_max]
      const box: [number, number, number, number] = [
        Math.round(currentRect.y),
        Math.round(currentRect.x),
        Math.round(currentRect.y + currentRect.h),
        Math.round(currentRect.x + currentRect.w),
      ];
      setPendingBox(box);
      setShowLabelDialog(true);
    }
    
    setDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  }, [drawing, currentRect]);

  const handleLabelSelect = useCallback((type: 'anatomy' | 'pathology' | 'device', label: string) => {
    if (pendingBox) {
      onAddAnnotation({
        label,
        box_2d: pendingBox,
        type,
      });
      setPendingBox(null);
    }
    setShowLabelDialog(false);
  }, [pendingBox, onAddAnnotation]);

  // Reset when image changes
  useEffect(() => { setRendered(null); }, [image?.preview_url]);

  // Recalc on container resize (window resize / sidebar toggle)
  useEffect(() => {
    const obs = new ResizeObserver(calcSize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [calcSize]);

  // Handle ESC key to exit drawing mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        onToggleDrawing(false);
        setDrawing(false);
        setStartPos(null);
        setCurrentRect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, onToggleDrawing]);

  const filterStr = [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    filters.invert ? 'invert(1)' : '',
  ].filter(Boolean).join(' ');

  const visibleTypes = LEGEND_TYPES.filter(({ type }) =>
    annotations.some(a => a.type === type)
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#050508]"
    >
      {/* Corner-bracket DICOM-style frame */}
      <div className="absolute top-3 left-3  w-5 h-5 border-t-2 border-l-2 border-[rgba(0,212,255,0.28)] pointer-events-none" />
      <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[rgba(0,212,255,0.28)] pointer-events-none" />
      <div className="absolute bottom-3 left-3  w-5 h-5 border-b-2 border-l-2 border-[rgba(0,212,255,0.28)] pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[rgba(0,212,255,0.28)] pointer-events-none" />

      {!image ? (
        <ImageUploader onFile={onFile} uploading={uploading} />
      ) : (
        <>
          {/* X-ray image */}
          <img
            ref={imgRef}
            src={image.preview_url}
            alt="Medical X-Ray"
            onLoad={calcSize}
            className="max-w-full max-h-full block select-none"
            style={{
              filter:          filterStr,
              transform:       `scale(${filters.zoom / 100})`,
              transformOrigin: 'center center',
            }}
            draggable={false}
          />

          {/* SVG annotation overlay — single consolidated SVG */}
          {showAnnotations && (annotations.length > 0 || manualAnnotations.length > 0) && rendered && (
            <svg
              ref={svgRef}
              className={`absolute transition-cursor duration-150`}
              style={{
                left:            '50%',
                top:             '50%',
                width:           rendered.w,
                height:          rendered.h,
                transform:       `translate(-50%, -50%) scale(${filters.zoom / 100})`,
                transformOrigin: 'center center',
                overflow:        'visible',
                pointerEvents:   isDrawing ? 'auto' : 'none',
                cursor:          isDrawing ? 'crosshair' : 'default',
              }}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
            >
              {/* Auto-labeled annotations */}
              {annotations.map((ann, i) => (
                <AnnotationBox key={`auto-${i}`} ann={ann} isManual={false} />
              ))}
              
              {/* Manual annotations with remove buttons */}
              {manualAnnotations.map((ann, i) => (
                <AnnotationBox
                  key={`manual-${i}`}
                  ann={ann}
                  isManual={true}
                  onRemove={() => onRemoveAnnotation(i)}
                />
              ))}

              {/* Drawing preview rectangle */}
              {isDrawing && currentRect && currentRect.w > 0 && currentRect.h > 0 && (
                <rect
                  x={currentRect.x}
                  y={currentRect.y}
                  width={currentRect.w}
                  height={currentRect.h}
                  fill="#00d4ff"
                  fillOpacity="0.1"
                  stroke="#00d4ff"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  pointerEvents="none"
                />
              )}
            </svg>
          )}

          {/* Subtle crosshair */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[rgba(0,212,255,0.06)]" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px   bg-[rgba(0,212,255,0.06)]" />
          </div>

          {/* Annotation legend */}
          {showAnnotations && visibleTypes.length > 0 && (
            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-lg px-3 py-2.5 bg-[rgba(8,8,16,0.82)] border border-[#1e2040] backdrop-blur-sm">
              <p className="text-[9px] font-mono text-[#4a5568] uppercase tracking-[2px] mb-0.5">Legend</p>
              {visibleTypes.map(({ type, label }) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: TYPE_COLOR[type] }}
                  />
                  <span className="text-[10px] font-mono text-[#8892b0]">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Label dialog */}
          <LabelDialog
            isOpen={showLabelDialog}
            onSelect={handleLabelSelect}
            onCancel={() => {
              setShowLabelDialog(false);
              setPendingBox(null);
            }}
          />
        </>
      )}
    </div>
  );
}
