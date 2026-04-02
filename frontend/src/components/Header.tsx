import React, { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

interface HeaderProps {
  imageLoaded: boolean;
  filename?: string;
}

export default function Header({ imageLoaded, filename }: HeaderProps) {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [providerInfo, setProviderInfo] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        setApiStatus(d.status === 'healthy' ? 'online' : 'offline');
        setProviderInfo(d.provider ? `${d.provider.toUpperCase()} — ${d.model || ''}` : '');
      })
      .catch(() => setApiStatus('offline'));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = currentTime.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });

  return (
    <header className="flex items-center justify-between px-6 h-[60px] bg-[#0c0c1a] border-b border-[#1e2040] flex-shrink-0 relative z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#0044cc] flex items-center justify-center text-lg shadow-[0_0_24px_rgba(0,212,255,0.4)] flex-shrink-0">
          🩻
        </div>
        <div>
          <div className="text-[18px] font-bold bg-gradient-to-r from-[#00d4ff] to-[#7744ff] bg-clip-text text-transparent tracking-tight leading-none mb-0.5">
            MedGemma
          </div>
          <div className="text-[9px] text-[#4a5568] tracking-[2.5px] uppercase font-mono">
            AI Radiology Platform
          </div>
        </div>
      </div>

      {/* Center — API status pill */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#141428] border border-[#1e2040]">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            apiStatus === 'online'
              ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse-glow'
              : apiStatus === 'offline'
              ? 'bg-[#ff4444] shadow-[0_0_8px_#ff4444]'
              : 'bg-[#ffbb00] shadow-[0_0_8px_#ffbb00] animate-pulse-glow'
          }`}
        />
        <span className="text-[11px] font-mono text-[#8892b0] tracking-[1.5px]">
          {apiStatus === 'checking'
            ? 'CONNECTING...'
            : apiStatus === 'online'
            ? (providerInfo || 'MEDGEMMA READY')
            : 'MODEL SETUP NEEDED'}
        </span>
      </div>

      {/* Right — workstation info */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-[#4a5568]">
        <span className="flex items-center gap-1.5">
          <Monitor size={11} className="opacity-50" />
          WS-01
        </span>
        <span className="text-[#1e2040]">│</span>
        <span>{dateStr}</span>
        <span className="text-[#8892b0]">{timeStr}</span>
        {imageLoaded && filename && (
          <>
            <span className="text-[#1e2040]">│</span>
            <span className="text-[#00d4ff] max-w-[180px] truncate">{filename.toUpperCase()}</span>
          </>
        )}
      </div>
    </header>
  );
}
