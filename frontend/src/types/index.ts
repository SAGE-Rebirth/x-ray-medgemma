export interface ImageMetadata {
  filename: string;
  width: number;
  height: number;
  format: string;
  mode: string;
  size_bytes: number;
}

export interface UploadedImage {
  image_data: string;
  mime_type: string;
  metadata: ImageMetadata;
  preview_url: string;
}

export type AnalysisTool = 'full' | 'bone' | 'soft_tissue' | 'pathology' | 'cardiac' | 'compare';

export interface AnalysisState {
  isAnalyzing: boolean;
  streamedText: string;
  isComplete: boolean;
  error: string | null;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  invert: boolean;
  zoom: number;
}

export interface Annotation {
  label: string;
  box_2d: [number, number, number, number]; // [y_min, x_min, y_max, x_max] in 0–1000
  type: 'anatomy' | 'pathology' | 'device';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
