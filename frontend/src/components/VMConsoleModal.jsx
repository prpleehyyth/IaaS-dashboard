import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Maximize2, Minimize2, X, RefreshCw, Copy, Check, ExternalLink, Monitor, Play, Cpu, HardDrive } from 'lucide-react';
import { api } from '../api/client';

export default function VMConsoleModal({ vm, onClose }) {
  const [session, setSession] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  const [connectionStep, setConnectionStep] = useState('Meminta tiket akses konsol...');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'novnc'
  const wsRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function initConsole() {
      try {
        setConnectionStatus('CONNECTING');
        setConnectionStep('Membuat sesi konsol VNC/Serial aman...');
        
        // Request console session ticket from backend
        const sess = await api.createConsoleSession(vm.id);
        if (!isMounted) return;
        setSession(sess);

        setConnectionStep('Membuka WebSocket tunnel ke VM...');

        // Connect to WebSocket
        const wsUrl = sess.websocket_url 
          ? api.getConsoleWsUrl(sess.websocket_url)
          : api.getConsoleWsUrl(sess.ticket || sess.token, vm.id);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('CONNECTED');
          setConnectionStep('Konsol Terhubung');
          setTerminalOutput(`\x1b[1;32m[OK]\x1b[0m Direct tunnel provisioned via hypervisor ${vm.hypervisor_type}.\r\n` +
            `\x1b[1;32m*** VIRTUAL MACHINE CONSOLE CONNECTED (${vm.os_type || 'Linux'}) ***\x1b[0m\r\n` +
            `Type commands or use quick action buttons below.\r\n\r\n`);
          if (terminalRef.current) {
            terminalRef.current.focus();
          }
        };

// Remove last character from terminal buffer while preserving prompt and ANSI structure
const removeLastTerminalChar = (str) => {
  if (!str || str.length === 0) return '';
  // Safeguard: never delete past prompt boundaries or line breaks
  if (str.endsWith('~# ') || str.endsWith('~$ ') || str.endsWith('\n') || str.endsWith('\r')) {
    return str;
  }
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]$/;
  let trailingAnsi = '';
  let temp = str;
  while (ansiRegex.test(temp)) {
    const match = temp.match(ansiRegex);
    trailingAnsi = match[0] + trailingAnsi;
    temp = temp.slice(0, -match[0].length);
  }
  if (temp.length > 0 && !temp.endsWith('~# ') && !temp.endsWith('~$ ') && !temp.endsWith('\n') && !temp.endsWith('\r')) {
    temp = temp.slice(0, -1);
  }
  return temp + trailingAnsi;
};

// Process terminal stream including backspace erasure sequences, ANSI clear, and control codes
const processTerminalStream = (prev, data) => {
  if (!data) return prev;
  let current = prev;
  let i = 0;
  while (i < data.length) {
    // Clear screen escape sequence: \x1b[2J\x1b[H or \x1b[2J
    if (data.startsWith('\x1b[2J\x1b[H', i)) {
      current = '';
      i += 8;
      continue;
    }
    if (data.startsWith('\x1b[2J', i)) {
      current = '';
      i += 4;
      continue;
    }
    // Standard terminal backspace erasure sequence: \b \b (\x08 \x08)
    if (data.startsWith('\b \b', i) || data.startsWith('\x08 \x08', i)) {
      current = removeLastTerminalChar(current);
      i += 3;
      continue;
    }
    // Single Backspace / DEL control codes: \b, \x08, \x7f
    if (data[i] === '\b' || data[i] === '\x08' || data[i] === '\x7f') {
      current = removeLastTerminalChar(current);
      i += 1;
      continue;
    }
    // Normal character
    current += data[i];
    i += 1;
  }
  return current;
};

        ws.onmessage = (event) => {
          if (!isMounted) return;
          setTerminalOutput(prev => processTerminalStream(prev, event.data));
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setConnectionStatus('DISCONNECTED');
          setTerminalOutput(prev => prev + '\r\n\x1b[1;31m[Koneksi Terputus]\x1b[0m Sesi remote console telah ditutup.\r\n');
        };

        ws.onerror = (err) => {
          if (!isMounted) return;
          console.error("Terminal WebSocket error:", err);
          setConnectionStatus('ERROR');
          setTerminalOutput(prev => prev + '\r\n\x1b[1;31m[Error]\x1b[0m Kegagalan komunikasi WebSocket remote console.\r\n');
        };

      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to initialize console session:", err);
        setConnectionStatus('ERROR');
        setTerminalOutput(`\r\n\x1b[1;31m[Gagal Terhubung]\x1b[0m ${err.message || 'Tidak dapat membuat tunnel konsol ke virtual machine'}\r\n`);
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

  // Focus terminal whenever connected
  useEffect(() => {
    if (connectionStatus === 'CONNECTED' && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [connectionStatus]);

  // Handle keystrokes sent to terminal
  const handleKeyDown = (e) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      wsRef.current.send('\r');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      wsRef.current.send('\x7f');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      wsRef.current.send('\t');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      wsRef.current.send(e.key);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      wsRef.current.send('\x03'); // ETX
    } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      wsRef.current.send('\x04'); // EOT
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      wsRef.current.send('\x0c'); // Form Feed / Clear
    }
  };

  const handlePaste = (e) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (text) {
      wsRef.current.send(text);
    }
  };

  // Quick Command buttons
  const sendQuickCommand = (cmd) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + '\r');
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    }
  };

  const copyIP = () => {
    if (vm.ip_address) {
      navigator.clipboard.writeText(vm.ip_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Convert ANSI escape sequences to HTML spans and strip non-printable control characters
  const renderAnsi = (text) => {
    // Strip non-printable control characters that render as glyph boxes in browsers
    const sanitized = (text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
    let clean = sanitized
      .replace(/\x1b\[1;32m/g, '<span style="color:#34d399;font-weight:bold;">')
      .replace(/\x1b\[1;34m/g, '<span style="color:#38bdf8;font-weight:bold;">')
      .replace(/\x1b\[1;36m/g, '<span style="color:#0ea5e9;font-weight:bold;">')
      .replace(/\x1b\[1;33m/g, '<span style="color:#fbbf24;font-weight:bold;">')
      .replace(/\x1b\[1;31m/g, '<span style="color:#fb7185;font-weight:bold;">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[2J\x1b\[H/g, '')
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    return clean;
  };

  return (
    <div className="modal-overlay">
      <div 
        className={`modal-content console-modal-content ${isFullscreen ? 'fullscreen' : ''}`}
        style={isFullscreen ? { maxWidth: '100vw', height: '100vh', borderRadius: 0 } : {}}
      >
        {/* Terminal Header */}
        <div className="terminal-header" style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="traffic-lights">
              <span className="traffic-dot red" onClick={onClose} style={{ cursor: 'pointer' }} title="Tutup"></span>
              <span className="traffic-dot yellow" onClick={() => sendQuickCommand('clear')} style={{ cursor: 'pointer' }} title="Bersihkan Layar"></span>
              <span className="traffic-dot green" onClick={() => setIsFullscreen(!isFullscreen)} style={{ cursor: 'pointer' }} title="Toggle Layar Penuh"></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={15} color="#38bdf8" />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffffff' }}>
                {vm.name}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                ({vm.hypervisor_type} • {session?.protocol ? session.protocol.toUpperCase() : 'VNC/WebMKS'})
              </span>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('terminal')}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 10px',
                  background: activeTab === 'terminal' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  borderColor: activeTab === 'terminal' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'terminal' ? '#38bdf8' : 'var(--text-dim)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Terminal size={12} />
                <span>Web Shell</span>
              </button>

              {session?.novnc_url && (
                <button
                  type="button"
                  onClick={() => setActiveTab('novnc')}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.74rem',
                    padding: '3px 10px',
                    background: activeTab === 'novnc' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    borderColor: activeTab === 'novnc' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                    color: activeTab === 'novnc' ? '#38bdf8' : 'var(--text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Monitor size={12} />
                  <span>Display Grafis (NoVNC)</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${connectionStatus === 'CONNECTED' ? 'online' : connectionStatus === 'CONNECTING' ? 'stopping' : 'error'}`}></span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: connectionStatus === 'CONNECTED' ? '#34d399' : connectionStatus === 'CONNECTING' ? '#38bdf8' : '#fb7185' }}>
                {connectionStatus}
              </span>
            </div>

            {/* Quick Copy IP */}
            {vm.ip_address && (
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={copyIP} 
                style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#ffffff' }}
                title="Salin IP Virtual Machine"
              >
                {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{vm.ip_address}</span>
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{ padding: '4px 8px' }}
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onClose}
              style={{ padding: '4px 8px' }}
              title="Tutup Konsol"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick Commands Ribbon */}
        {activeTab === 'terminal' && (
          <div style={{ background: '#051122', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.04em' }}>QUICK COMMANDS:</span>
            {['uname -a', 'uptime', 'free -h', 'ip a', 'df -h', 'top', 'clear'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => sendQuickCommand(cmd)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '3px 9px', background: 'rgba(2, 132, 199, 0.15)', borderColor: 'rgba(56, 189, 248, 0.25)', color: '#e0f2fe' }}
              >
                {cmd}
              </button>
            ))}
            <button
              onClick={() => sendQuickCommand('reboot')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '3px 9px', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)', marginLeft: 'auto' }}
              title="Kirim sinyal reboot ke sistem operasi"
            >
              Reboot VM
            </button>
          </div>
        )}

        {/* Content Container (Terminal or NoVNC) */}
        <div style={{ position: 'relative', flex: 1, minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
          
          {/* OPTIMASI LAYER AWAL: Sleek Connection State Layer */}
          {connectionStatus === 'CONNECTING' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              padding: '24px',
              color: '#ffffff'
            }}>
              {/* Pulsing Glowing Pulse Circle */}
              <div style={{
                position: 'relative',
                width: '68px',
                height: '68px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(56, 189, 248, 0.15)',
                  borderTopColor: '#38bdf8',
                  animation: 'spin 0.9s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite'
                }} />
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 24px rgba(56, 189, 248, 0.35)'
                }}>
                  <Terminal size={22} color="#38bdf8" />
                </div>
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px', letterSpacing: '-0.01em' }}>
                Menghubungkan ke Konsol VM
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: '22px', textAlign: 'center', maxWidth: '420px', lineHeight: 1.5 }}>
                Membangun koneksi tunnel VNC/Serial terenkripsi ke instance <strong style={{ color: '#ffffff' }}>{vm.name}</strong>
              </p>

              {/* VM Profile Mini Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                background: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '12px 20px',
                marginBottom: '20px',
                width: '100%',
                maxWidth: '440px',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Hypervisor</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>{vm.hypervisor_type}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>IP Address</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {vm.ip_address || 'DHCP'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Sistem Operasi</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {vm.os_type || 'Linux OS'}
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                <RefreshCw size={14} className="spin" />
                <span>{connectionStep}</span>
              </div>

              {session?.novnc_url && (
                <a
                  href={session.novnc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    marginTop: '16px',
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    background: 'rgba(56, 189, 248, 0.1)',
                    padding: '6px 14px',
                    fontSize: '0.8rem'
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Buka Grafis NoVNC (Layar Monitor VM)</span>
                </a>
              )}
            </div>
          )}

          {/* Mode 1: Interactive Terminal Window */}
          {activeTab === 'terminal' && (
            <div 
              ref={terminalRef}
              className="terminal-window"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              title="Klik di sini untuk mulai mengetik ke konsol VM"
              style={{ flex: 1, minHeight: '380px' }}
            >
              <span dangerouslySetInnerHTML={{ __html: renderAnsi(terminalOutput) }} />
              {connectionStatus === 'CONNECTED' && <span className="terminal-cursor" />}
            </div>
          )}

          {/* Mode 2: NoVNC Graphical Console Viewer */}
          {activeTab === 'novnc' && session?.novnc_url && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#020617', padding: '16px', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', maxWidth: '480px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '28px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Monitor size={28} color="#38bdf8" />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  Layar Grafis Proxmox / VMware NoVNC
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: '22px' }}>
                  Viewer grafis NoVNC menampilkan output monitor langsung dari BIOS, GRUB, dan boot installer sistem operasi.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <a
                    href={session.novnc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', fontSize: '0.86rem' }}
                  >
                    <ExternalLink size={15} />
                    <span>Buka NoVNC di Tab Baru</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveTab('terminal')}
                    className="btn btn-secondary"
                    style={{ padding: '9px 18px', fontSize: '0.86rem', color: '#ffffff' }}
                  >
                    Kembali ke Terminal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
