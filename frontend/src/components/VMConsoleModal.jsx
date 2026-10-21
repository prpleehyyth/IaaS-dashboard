import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Terminal, 
  RotateCcw, 
  ShieldCheck, 
  Copy,
  Check
} from 'lucide-react';
import { api } from '../api/client';

export default function VMConsoleModal({ vm, onClose }) {
  const [session, setSession] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const wsRef = useRef(null);
  const terminalRef = useRef(null);
  const inputBufferRef = useRef('');

  useEffect(() => {
    let isMounted = true;

    async function initConsole() {
      try {
        setTerminalOutput('\x1b[1;34m[Console Agent] Initializing secure connection ticket...\x1b[0m\r\n');
        const sess = await api.requestConsoleSession(vm.id);
        if (!isMounted) return;
        setSession(sess);

        // Establish WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/vms/${vm.id}/console/ws?ticket=${sess.ticket}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('CONNECTED');
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          // Strip or translate basic ANSI escape codes for display
          setTerminalOutput((prev) => prev + event.data);
        };

        ws.onerror = (err) => {
          console.error("Console WebSocket Error:", err);
          if (!isMounted) return;
          setConnectionStatus('ERROR');
          setTerminalOutput((prev) => prev + '\r\n\x1b[1;31m[Console Error] WebSocket connection failed.\x1b[0m\r\n');
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnectionStatus('DISCONNECTED');
          setTerminalOutput((prev) => prev + '\r\n\x1b[1;33m[Console Closed] Session terminated.\x1b[0m\r\n');
        };

      } catch (err) {
        if (!isMounted) return;
        setConnectionStatus('ERROR');
        setTerminalOutput(`\r\n\x1b[1;31m[Error] Failed to initialize console: ${err.message}\x1b[0m\r\n`);
      }
    }

    initConsole();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [vm.id]);

  // Scroll to bottom on output change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const handleKeyDown = (e) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (e.key === 'Enter') {
      wsRef.current.send('\r');
      inputBufferRef.current = '';
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      wsRef.current.send('\b');
      e.preventDefault();
    } else if (e.key === 'Tab') {
      wsRef.current.send('\t');
      e.preventDefault();
    } else if (e.ctrlKey && e.key === 'c') {
      wsRef.current.send(String.fromCharCode(3));
      e.preventDefault();
    } else if (e.key.length === 1 && !e.altKey && !e.metaKey && !e.ctrlKey) {
      wsRef.current.send(e.key);
      e.preventDefault();
    }
  };

  const sendQuickCommand = (cmd) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(cmd + '\r');
  };

  const copyIP = () => {
    if (vm.ip_address) {
      navigator.clipboard.writeText(vm.ip_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Convert ANSI escape sequences to HTML spans
  const renderAnsi = (text) => {
    // Basic ANSI color mapper
    let clean = text
      .replace(/\x1b\[1;32m/g, '<span style="color:#10b981;font-weight:bold;">')
      .replace(/\x1b\[1;34m/g, '<span style="color:#60a5fa;font-weight:bold;">')
      .replace(/\x1b\[1;36m/g, '<span style="color:#00f2fe;font-weight:bold;">')
      .replace(/\x1b\[1;33m/g, '<span style="color:#fbbf24;font-weight:bold;">')
      .replace(/\x1b\[1;31m/g, '<span style="color:#f43f5e;font-weight:bold;">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[2J\x1b\[H/g, ''); // Clear code
    return { __html: clean };
  };

  return (
    <div className="modal-overlay">
      <div 
        className={`modal-content console-modal-content ${isFullscreen ? 'fullscreen' : ''}`}
        style={isFullscreen ? { maxWidth: '100vw', height: '100vh', borderRadius: 0 } : {}}
      >
        {/* Terminal Header */}
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="traffic-lights">
              <span className="traffic-dot red" onClick={onClose} style={{ cursor: 'pointer' }} title="Close"></span>
              <span className="traffic-dot yellow" onClick={() => sendQuickCommand('clear')} style={{ cursor: 'pointer' }} title="Clear Screen"></span>
              <span className="traffic-dot green" onClick={() => setIsFullscreen(!isFullscreen)} style={{ cursor: 'pointer' }} title="Toggle Fullscreen"></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={15} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
                {vm.name}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                ({vm.hypervisor_type} • {session?.protocol ? session.protocol.toUpperCase() : 'VNC/WebMKS'})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${connectionStatus === 'CONNECTED' ? 'online' : connectionStatus === 'CONNECTING' ? 'stopping' : 'error'}`}></span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: connectionStatus === 'CONNECTED' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                {connectionStatus}
              </span>
            </div>

            {/* Quick Copy IP */}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={copyIP} 
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              title="Copy VM IP"
            >
              {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
              <span>{vm.ip_address}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{ padding: '4px 8px' }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onClose}
              style={{ padding: '4px 8px' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick Commands Ribbon */}
        <div style={{ background: '#090d16', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>QUICK COMMANDS:</span>
          {['uname -a', 'uptime', 'free -h', 'ip a', 'df -h', 'top', 'clear'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(255,255,255,0.04)' }}
            >
              {cmd}
            </button>
          ))}
          <button
            onClick={() => sendQuickCommand('reboot')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--accent-rose)', marginLeft: 'auto' }}
          >
            Send Reboot
          </button>
        </div>

        {/* Interactive Terminal Window */}
        <div 
          ref={terminalRef}
          className="terminal-window"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          title="Click to focus keyboard input"
          dangerouslySetInnerHTML={renderAnsi(terminalOutput)}
        />
      </div>
    </div>
  );
}
