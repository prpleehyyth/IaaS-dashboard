import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Maximize2, Minimize2, X, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../api/client';

export default function VMConsoleModal({ vm, onClose }) {
  const [session, setSession] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [copied, setCopied] = useState(false);
  const wsRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function initConsole() {
      try {
        setTerminalOutput(`\x1b[1;34m[PT PAL Private Cloud]\x1b[0m Initializing secure VNC/Serial web tunnel to node '${vm.name}'...\r\n`);
        
        // Request console session from backend
        const sess = await api.createConsoleSession(vm.id);
        if (!isMounted) return;
        setSession(sess);

        setTerminalOutput(prev => prev + `\x1b[1;32m[OK]\x1b[0m Direct tunnel provisioned via hypervisor ${vm.hypervisor_type} on host '${vm.node_id}'.\r\n`);
        setTerminalOutput(prev => prev + `\x1b[1;33m[Connecting]\x1b[0m Establishing multiplexed WebSocket telemetry stream...\r\n\r\n`);

        // Connect to WebSocket
        const wsUrl = sess.websocket_url 
          ? api.getConsoleWsUrl(sess.websocket_url)
          : api.getConsoleWsUrl(sess.ticket || sess.token, vm.id);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('CONNECTED');
          setTerminalOutput(prev => prev + `\x1b[1;32m*** NAVAL TERMINAL CONNECTED (${vm.os_type}) ***\x1b[0m\r\nType commands or use quick action buttons below.\r\n\r\n`);
          if (terminalRef.current) {
            terminalRef.current.focus();
          }
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          setTerminalOutput(prev => prev + event.data);
          // Auto-scroll
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnectionStatus('DISCONNECTED');
          setTerminalOutput(prev => prev + '\r\n\x1b[1;31m[Connection Terminated by Peer]\x1b[0m Remote console session closed.\r\n');
        };

        ws.onerror = (err) => {
          if (!isMounted) return;
          console.error("Terminal WebSocket error:", err);
          setConnectionStatus('ERROR');
          setTerminalOutput(prev => prev + '\r\n\x1b[1;31m[Error]\x1b[0m WebSocket communication failure.\r\n');
        };

      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to initialize console session:", err);
        setConnectionStatus('ERROR');
        setTerminalOutput(prev => prev + `\r\n\x1b[1;31m[Failed]\x1b[0m ${err.message || 'Could not establish console tunnel'}\r\n`);
      }
    }

    initConsole();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [vm]);

  // Handle keystrokes sent to terminal
  const handleKeyDown = (e) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Send special keys or regular keys
    if (e.key === 'Enter') {
      wsRef.current.send('\r');
    } else if (e.key === 'Backspace') {
      wsRef.current.send('\b');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      wsRef.current.send('\t');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      wsRef.current.send(e.key);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      wsRef.current.send('\x03'); // ETX
    } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      wsRef.current.send('\x04'); // EOT
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      wsRef.current.send('\x0c'); // Form Feed / Clear
    }
  };

  // Quick Command buttons
  const sendQuickCommand = (cmd) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + '\r');
    }
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
    let clean = text
      .replace(/\x1b\[1;32m/g, '<span style="color:#34d399;font-weight:bold;">')
      .replace(/\x1b\[1;34m/g, '<span style="color:#38bdf8;font-weight:bold;">')
      .replace(/\x1b\[1;36m/g, '<span style="color:#0ea5e9;font-weight:bold;">')
      .replace(/\x1b\[1;33m/g, '<span style="color:#fbbf24;font-weight:bold;">')
      .replace(/\x1b\[1;31m/g, '<span style="color:#fb7185;font-weight:bold;">')
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
              <Terminal size={15} color="#38bdf8" />
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff' }}>
                {vm.name}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                ({vm.hypervisor_type} • {session?.protocol ? session.protocol.toUpperCase() : 'VNC/WebMKS'})
              </span>
            </div>

            {session?.novnc_url && (
              <a
                href={session.novnc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 10px',
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none'
                }}
                title="Buka Grafis Proxmox NoVNC Viewer (Layar OS / BIOS Installer)"
              >
                <ExternalLink size={12} />
                <span>Buka NoVNC GUI</span>
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${connectionStatus === 'CONNECTED' ? 'online' : connectionStatus === 'CONNECTING' ? 'stopping' : 'error'}`}></span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: connectionStatus === 'CONNECTED' ? '#34d399' : 'var(--text-muted)' }}>
                {connectionStatus}
              </span>
            </div>

            {/* Quick Copy IP */}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={copyIP} 
              style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#ffffff' }}
              title="Copy Vessel IP"
            >
              {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
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
        <div style={{ background: '#051122', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>NAVAL COMMANDS:</span>
          {['uname -a', 'uptime', 'free -h', 'ip a', 'df -h', 'top', 'clear'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '3px 9px', background: 'rgba(2, 132, 199, 0.15)', borderColor: 'rgba(56, 189, 248, 0.25)' }}
            >
              {cmd}
            </button>
          ))}
          <button
            onClick={() => sendQuickCommand('reboot')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.72rem', padding: '3px 9px', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)', marginLeft: 'auto' }}
          >
            Send Reboot Signal
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
