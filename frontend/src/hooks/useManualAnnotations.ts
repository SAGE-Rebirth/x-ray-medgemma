import { useState, useCallback } from 'react';
import { Annotation } from '../types';

export function useManualAnnotations() {
  const [manualAnnotations, setManualAnnotations] = useState<Annotation[]>([]);

  const addAnnotation = useCallback((annotation: Annotation) => {
    setManualAnnotations(prev => [...prev, annotation]);
  }, []);

  const removeAnnotation = useCallback((index: number) => {
    setManualAnnotations(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateAnnotation = useCallback((index: number, annotation: Annotation) => {
    setManualAnnotations(prev => {
      const updated = [...prev];
      updated[index] = annotation;
      return updated;
    });
  }, []);

  const clearManualAnnotations = useCallback(() => {
    setManualAnnotations([]);
  }, []);

  return {
    manualAnnotations,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearManualAnnotations,
  };
}
