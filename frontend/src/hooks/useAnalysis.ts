import { useState, useCallback } from 'react';
import { UploadedImage, AnalysisState, AnalysisTool } from '../types';

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    streamedText: '',
    isComplete: false,
    error: null,
  });

  const startAnalysis = useCallback(async (image: UploadedImage, tool: AnalysisTool = 'full') => {
    setState({ isAnalyzing: true, streamedText: '', isComplete: false, error: null });

    const endpoint = tool === 'full' ? '/api/analyze' : '/api/analyze/tool';
    const body = tool === 'full'
      ? { image_data: image.image_data, mime_type: image.mime_type }
      : { image_data: image.image_data, mime_type: image.mime_type, tool };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.error) {
                setState(prev => ({ ...prev, isAnalyzing: false, error: parsed.error, isComplete: true }));
                return;
              }
              if (parsed.done) {
                setState(prev => ({ ...prev, isAnalyzing: false, isComplete: true }));
              } else if (parsed.text) {
                setState(prev => ({ ...prev, streamedText: prev.streamedText + parsed.text }));
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        isComplete: true,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isAnalyzing: false, streamedText: '', isComplete: false, error: null });
  }, []);

  return { ...state, startAnalysis, reset };
}
