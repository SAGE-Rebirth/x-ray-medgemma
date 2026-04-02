import { useState, useCallback } from 'react';
import { UploadedImage, Annotation } from '../types';

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchAnnotations = useCallback(async (image: UploadedImage) => {
    setIsLoading(true);
    setError(null);
    setAnnotations([]);
    try {
      const res  = await fetch('/api/analyze/annotate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image_data: image.image_data, mime_type: image.mime_type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Annotation failed');
      // Only pathology type annotations (defective areas)
      const pathologyOnly = (data.annotations ?? []).filter((ann: Annotation) => ann.type === 'pathology');
      setAnnotations(pathologyOnly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annotation failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setError(null);
  }, []);

  return { annotations, isLoading, error, fetchAnnotations, clearAnnotations };
}
