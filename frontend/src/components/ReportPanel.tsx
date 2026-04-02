import React from 'react';

// Section identifiers for structured report parsing
const SECTIONS = [
  { key: 'technical', label: 'Technical Quality', icon: '🔬', pattern: /technical quality/i },
  { key: 'findings', label: 'Systematic Findings', icon: '📋', pattern: /systematic findings/i },
  { key: 'abnormal', label: 'Abnormal Findings', icon: '⚠️', pattern: /abnormal findings/i },
  { key: 'impression', label: 'Clinical Impression', icon: '🎯', pattern: /clinical impression/i },
  { key: 'differential', label: 'Differential Diagnoses', icon: '🔄', pattern: /differential diagnos/i },
  { key: 'recommendations', label: 'Recommendations', icon: '📌', pattern: /recommendations/i },
  { key: 'urgency', label: 'Urgency Level', icon: '🚨', pattern: /urgency level/i },
];

interface ReportPanelProps {
  text: string;
  isComplete: boolean;
}

/**
 * Parses the streamed markdown text into named sections.
 */
function parseSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous buffer
      if (currentKey) result[currentKey] = buffer.join('\n').trim();
      // Determine new section
      const matched = SECTIONS.find(s => s.pattern.test(line));
      currentKey = matched ? matched.key : null;
      buffer = [];
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  if (currentKey) result[currentKey] = buffer.join('\n').trim();

  return result;
}

export default function ReportPanel({ text, isComplete }: ReportPanelProps) {
  if (!text || !isComplete) return null;

  const sections = parseSections(text);
  const hasSections = Object.keys(sections).length > 0;

  if (!hasSections) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: 'var(--text-dim)',
          marginBottom: 12,
        }}
      >
        Structured Report
      </div>

      {SECTIONS.filter(s => sections[s.key]).map(section => (
        <div
          key={section.key}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{section.icon}</span>
            <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              {section.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {sections[section.key]}
          </div>
        </div>
      ))}
    </div>
  );
}
