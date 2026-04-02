import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '../types';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    userMessage: string,
    imageData: string,
    mimeType: string,
    reportText: string,
  ) => {
    const userMsg: ChatMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    // Build history for API (include the new user message)
    const history = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: imageData,
          mime_type: mimeType,
          report: reportText,
          messages: history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Chat failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      // Add empty assistant message to fill via streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: `Error: ${parsed.error}` };
                  return updated;
                });
                setIsStreaming(false);
                return;
              }
              if (parsed.text) {
                assistantText += parsed.text;
                const captured = assistantText;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: captured };
                  return updated;
                });
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          };
          return updated;
        }
        return [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }];
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage, clearChat };
}
