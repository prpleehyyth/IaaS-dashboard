import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  AlertCircle, 
  Disc, 
  RefreshCw, 
  Network, 
  Shield, 
  Layers, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  CheckCircle,
  Receipt
} from 'lucide-react';
import { api } from '../api/client';
import { 
  TIER_DEFINITIONS, 
  formatCurrencyIDR 
} from '../constants/pricingCatalog';

export const extractIsoVersion = (filename) => {
  if (!filename) return null;
  // Match version patterns like 26.04, 24.04.1, 12.5.0, 3.19.1, 9.3, 2022, 2019, etc.
  const match = filename.match(/\b(\d{1,4}(\.\d+)+|\b20\d{2}\b)/);
  return match ? match[0] : null;
};

const OS_OPTIONS = [
  'Ubuntu',
  'Debian',
  'Rocky Linux',
  'Alpine Linux',
  'Arch Linux',
  'Windows Server',
  'Custom / Other Linux'
];

// 4 Sizing Options: Tier 1, Tier 2, Tier 3, and Full Customization
const SIZING_OPTIONS = [
  {
    key: 'TIER_1',
    name: 'Tier 1 (Internal / Hemat)',
    badge: 'Hemat / Internal',
    desc: 'Untuk beban kerja internal, staging, dan lab pengujian non-kritis.',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    isCustom: false,
    cpu: 2,
    ram: 4,
    disk: 50,
    rates: TIER_DEFINITIONS.TIER_1.rates,
  },
  {
    key: 'TIER_2',
    name: 'Tier 2 (Standar PT)',
    badge: 'Standar PT PAL',
    desc: 'Untuk server aplikasi standar perusahaan, web service, dan basis data operasional.',
    color: '#1e3a8a',
    bg: '#eff6ff',
    border: '#bfdbfe',
    isCustom: false,
    cpu: 4,
    ram: 8,
    disk: 100,
    rates: TIER_DEFINITIONS.TIER_2.rates,
  },
  {
    key: 'TIER_3',
    name: 'Tier 3 (Enterprise / HA)',
    badge: 'Enterprise / HA',
    desc: 'Untuk sistem produksi misi kritis, ERP galangan kapal, dan cluster database redundan.',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    isCustom: false,
    cpu: 8,
    ram: 16,
    disk: 200,
    rates: TIER_DEFINITIONS.TIER_3.rates,
  },
  {
    key: 'CUSTOM',
    name: 'Full Customization',
    badge: 'Kustom Bebas',
    desc: 'Konfigurasi mandiri alokasi vCPU, RAM, dan Storage disk sesuai kebutuhan spesifik.',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    isCustom: true,
    cpu: 4,
    ram: 8,
    disk: 100,
    rates: TIER_DEFINITIONS.TIER_2.rates,
  }
];

const STEPS = [
  { id: 1, title: 'Paket & Spesifikasi', shortTitle: 'Paket Tier', icon: Layers },
  { id: 2, title: 'Identitas & Lokasi', shortTitle: 'Identitas', icon: Server },
  { id: 3, title: 'OS & Boot Media', shortTitle: 'OS & Boot', icon: Disc },
  { id: 4, title: 'Jaringan & VLAN', shortTitle: 'Jaringan', icon: Network },
  { id: 5, title: 'Review & Konfirmasi', shortTitle: 'Review', icon: CheckCircle2 }
];

export default function CreateVMModal({ clusters, onClose, onCreate }) {
  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: 4 Sizing Options (Tier 1, Tier 2, Tier 3, Full Customization)
  const [activeTierKey, setActiveTierKey] = useState('TIER_1');
  const [cpuCores, setCpuCores] = useState(2);
  const [ramGB, setRamGB] = useState(4);
  const [diskGB, setDiskGB] = useState(50);
  // Custom specs state for Full Customization
  const [customCpu, setCustomCpu] = useState(4);
  const [customRam, setCustomRam] = useState(8);
  const [customDisk, setCustomDisk] = useState(100);
  const [customRateBasis, setCustomRateBasis] = useState('TIER_2');

  // Step 2: Placement & Identification
  const [name, setName] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState(clusters[0]?.id || '');
  const [selectedNodeId, setSelectedNodeId] = useState(clusters[0]?.nodes?.[0]?.id || '');

  // Step 3: OS & ISO
  const [osType, setOsType] = useState('Ubuntu');
  const [isoList, setIsoList] = useState([]);
  const [selectedIso, setSelectedIso] = useState('');
  const [isLoadingIsos, setIsLoadingIsos] = useState(false);
  const [filterByOS, setFilterByOS] = useState(true);

  // Step 4: Network & VLAN Configuration (802.1Q)
  const [noNetwork, setNoNetwork] = useState(false);
  const [networkBridge, setNetworkBridge] = useState('vmbr0');
  const [vlanTag, setVlanTag] = useState('');
  const [networkModel, setNetworkModel] = useState('virtio');
  const [firewall, setFirewall] = useState(true);
  const [macAddress, setMacAddress] = useState('');

  // Status & Validation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  const availableNodes = selectedCluster?.nodes || [];

  // Active Tier / Sizing Definition
  const activeTierDef = useMemo(() => {
    if (activeTierKey === 'CUSTOM') {
      const baseRates = TIER_DEFINITIONS[customRateBasis]?.rates || TIER_DEFINITIONS.TIER_2.rates;
      return {
        key: 'CUSTOM',
        name: 'Full Customization',
        badge: 'Kustomisasi Penuh',
        desc: 'Konfigurasi spesifikasi hardware (vCPU, RAM, Disk) secara fleksibel sesuai kebutuhan.',
        color: '#7c3aed',
        bg: '#f5f3ff',
        border: '#ddd6fe',
        rates: baseRates,
      };
    }
    return TIER_DEFINITIONS[activeTierKey] || TIER_DEFINITIONS.TIER_1;
  }, [activeTierKey, customRateBasis]);

  // Handle Sizing / Tier selection
  const handleSelectTier = (tierKey) => {
    setActiveTierKey(tierKey);
    if (tierKey === 'CUSTOM') {
      setCpuCores(customCpu);
      setRamGB(customRam);
      setDiskGB(customDisk);
    } else {
      const opt = SIZING_OPTIONS.find(o => o.key === tierKey);
      if (opt) {
        setCpuCores(opt.cpu);
        setRamGB(opt.ram);
        setDiskGB(opt.disk);
      }
    }
    setStepError('');
  };

  const handleCustomCpuChange = (val) => {
    const num = Math.max(1, Math.min(32, parseInt(val, 10) || 1));
    setCustomCpu(num);
    setCpuCores(num);
  };

  const handleCustomRamChange = (val) => {
    const num = Math.max(1, Math.min(64, parseInt(val, 10) || 1));
    setCustomRam(num);
    setRamGB(num);
  };

  const handleCustomDiskChange = (val) => {
    const num = Math.max(10, Math.min(500, parseInt(val, 10) || 10));
    setCustomDisk(num);
    setDiskGB(num);
  };

  // Estimated Monthly Cost for selected resources based on official catalog formula
  const estimatedCost = useMemo(() => {
    const tier = activeTierDef.rates;
    const cpuCost = cpuCores * (tier.cpuMonthly || 50000);
    const ramCost = ramGB * (tier.ramMonthly || 25000);
    const diskRate = tier.storageRates?.['STR-SSATA']?.monthly || 950;
    const diskCost = diskGB * diskRate;
    const virtCost = cpuCores * (tier.virtMonthly || 10000);
    const manCost = tier.manCostMonthly || 100000;
    const bwCost = tier.bandwidthMonthly || 75000;
    const otcSetup = tier.setupFeeOTC || 150000;
    
    const monthlyRecurring = cpuCost + ramCost + diskCost + virtCost + manCost + bwCost;
    return {
      monthly: monthlyRecurring,
      firstMonth: monthlyRecurring + otcSetup,
      otc: otcSetup,
      hourly: monthlyRecurring / 730
    };
  }, [activeTierDef, cpuCores, ramGB, diskGB]);

  // Filter ISO installer according to selected OS
  const filteredIsoList = useMemo(() => {
    if (!isoList || isoList.length === 0) return [];
    if (!filterByOS) return isoList;

    const osLower = (osType || '').toLowerCase();
    let keyword = '';
    if (osLower.includes('ubuntu')) keyword = 'ubuntu';
    else if (osLower.includes('debian')) keyword = 'debian';
    else if (osLower.includes('alpine')) keyword = 'alpine';
    else if (osLower.includes('rocky') || osLower.includes('rhel') || osLower.includes('centos')) keyword = 'rocky';
    else if (osLower.includes('arch')) keyword = 'arch';
    else if (osLower.includes('win')) keyword = 'win';

    if (!keyword) return isoList;

    return isoList.filter((iso) => {
      const fileName = (iso.filename || '').toLowerCase();
      const vol = (iso.volid || '').toLowerCase();
      if (keyword === 'rocky') {
        return fileName.includes('rocky') || fileName.includes('rhel') || fileName.includes('centos') ||
               vol.includes('rocky') || vol.includes('rhel') || vol.includes('centos');
      }
      return fileName.includes(keyword) || vol.includes(keyword);
    });
  }, [isoList, osType, filterByOS]);

  const selectedIsoObj = useMemo(() => {
    return isoList.find(i => i.volid === selectedIso);
  }, [isoList, selectedIso]);

  const fetchISOs = async (clusterId, nodeId) => {
    if (!clusterId) {
      setIsoList([]);
      setSelectedIso('');
      return;
    }
    setIsLoadingIsos(true);
    try {
      const isos = await api.getClusterISOs(clusterId, nodeId);
      setIsoList(isos || []);
    } catch (err) {
      console.warn('Failed to load ISO images:', err);
      setIsoList([]);
    } finally {
      setIsLoadingIsos(false);
    }
  };

  useEffect(() => {
    fetchISOs(selectedClusterId, selectedNodeId);
  }, [selectedClusterId, selectedNodeId]);

  // Auto-select matching ISO when filtered list updates or OS changes
  useEffect(() => {
    if (filteredIsoList.length > 0) {
      if (!selectedIso || !filteredIsoList.some(i => i.volid === selectedIso)) {
        setSelectedIso(filteredIsoList[0].volid);
      }
    } else if (filterByOS && isoList.length > 0) {
      setSelectedIso('');
    }
  }, [filteredIsoList, filterByOS]);

  const handleClusterChange = (newClusterId) => {
    setSelectedClusterId(newClusterId);
    const cluster = clusters.find(c => c.id === newClusterId);
    if (cluster && cluster.nodes && cluster.nodes.length > 0) {
      setSelectedNodeId(cluster.nodes[0].id);
    } else {
      setSelectedNodeId('');
    }
  };

  // Step Validation & Navigation
  const validateStep = (step) => {
    setStepError('');
    if (step === 1) {
      if (cpuCores < 1 || ramGB < 1 || diskGB < 10) {
        setStepError('Spesifikasi hardware tidak valid. Minimal 1 vCPU, 1 GB RAM, dan 10 GB Disk.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!name.trim()) {
        setStepError('Nama Virtual Machine wajib diisi sebelum melanjutkan.');
        return false;
      }
      if (!selectedClusterId) {
        setStepError('Target hypervisor cluster wajib dipilih.');
        return false;
      }
      if (!selectedNodeId && availableNodes.length > 0) {
        setStepError('Target compute node wajib dipilih.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!osType) {
        setStepError('Silakan pilih profil sistem operasi.');
        return false;
      }
      return true;
    }
    if (step === 4) {
      if (!noNetwork && !networkBridge.trim()) {
        setStepError('Network Bridge wajib diisi (misal: vmbr0) atau aktifkan opsi "No network device".');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setStepError('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleJumpToStep = (targetStep) => {
    if (targetStep < currentStep) {
      setStepError('');
      setCurrentStep(targetStep);
    } else if (targetStep > currentStep) {
      for (let s = currentStep; s < targetStep; s++) {
        if (!validateStep(s)) return;
      }
      setCurrentStep(targetStep);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setStepError('');

    if (!name.trim()) {
      setCurrentStep(2);
      setStepError('Nama Virtual Machine wajib diisi');
      return;
    }
    if (!selectedClusterId || !selectedNodeId) {
      setCurrentStep(2);
      setStepError('Target cluster dan compute node wajib dipilih');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        cluster_id: selectedClusterId,
        node_id: selectedNodeId,
        hypervisor_type: selectedCluster?.type || 'PROXMOX',
        cpu_cores: parseInt(cpuCores, 10),
        ram_mb: parseInt(ramGB, 10) * 1024,
        disk_gb: parseInt(diskGB, 10),
        os_type: osType,
        iso_image: selectedIso,
        // Network & VLAN configuration
        network_bridge: noNetwork ? 'none' : (networkBridge.trim() || 'vmbr0'),
        vlan_tag: (!noNetwork && vlanTag && parseInt(vlanTag, 10) > 0) ? parseInt(vlanTag, 10) : null,
        network_model: noNetwork ? 'none' : networkModel,
        firewall: !noNetwork ? firewall : false,
        mac_address: (!noNetwork && macAddress.trim() && macAddress.trim().toLowerCase() !== 'auto') ? macAddress.trim() : 'auto',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal memprovisioning virtual machine');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedNodeObj = availableNodes.find(n => n.id === selectedNodeId);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '920px', maxHeight: '92vh' }}>
        
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(30, 58, 138, 0.25)'
              }}>
                <Server size={18} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Deploy Virtual Machine
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '40px' }}>
              Hypervisor Provisioning Engine (Proxmox VE & VMware vSphere)
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }} title="Tutup">
            <X size={16} />
          </button>
        </div>

        {/* Stepper Navigation Tracker */}
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '12px 20px',
          overflowX: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            minWidth: '580px'
          }}>
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isPassed = currentStep > step.id;
              
              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      background: isPassed ? '#1e3a8a' : '#e2e8f0',
                      margin: '0 8px',
                      transition: 'background 0.3s ease'
                    }} />
                  )}
                  
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(step.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'transparent',
                      border: 'none',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    title={step.title}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      transition: 'all 0.2s ease',
                      background: isActive 
                        ? '#1e3a8a' 
                        : isPassed 
                          ? '#dbeafe' 
                          : '#ffffff',
                      color: isActive 
                        ? '#ffffff' 
                        : isPassed 
                          ? '#1e3a8a' 
                          : '#94a3b8',
                      border: isActive 
                        ? '2px solid #1e3a8a' 
                        : isPassed 
                          ? '2px solid #3b82f6' 
                          : '2px solid #cbd5e1',
                      boxShadow: isActive ? '0 0 0 3px rgba(30, 58, 138, 0.15)' : 'none'
                    }}>
                      {isPassed ? <Check size={14} strokeWidth={3} /> : step.id}
                    </div>

                    <div style={{ textAlign: 'left' }}>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#1e3a8a' : isPassed ? 'var(--text-main)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap'
                      }}>
                        {step.shortTitle}
                      </div>
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          
          {/* Cluster Status Warning */}
          {clusters.length === 0 && (
            <div style={{ 
              background: '#fffbeb', 
              border: '1px solid #fde68a', 
              padding: '12px 16px', 
              borderRadius: '8px', 
              color: '#b45309', 
              fontSize: '0.85rem', 
              marginBottom: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px' 
            }}>
              <AlertCircle size={18} />
              <span>
                <strong>Tidak ada cluster terdaftar.</strong> Daftarkan setidaknya 1 Proxmox atau VMware cluster pada tab <strong>Clusters</strong> sebelum mendeploy virtual machine.
              </span>
            </div>
          )}

          {/* Validation / API Error Banner */}
          {(error || stepError) && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca', 
              padding: '10px 14px', 
              borderRadius: '8px', 
              color: '#dc2626', 
              fontSize: '0.85rem', 
              marginBottom: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <AlertCircle size={16} />
              <span>{stepError || error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGAN 1: PILIH PAKET SPESIFIKASI (TIER 1, TIER 2, TIER 3, FULL CUSTOMIZATION) */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Layers size={18} style={{ color: '#1e3a8a' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Pilih Paket Spesifikasi VM (4 Pilihan):
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pilih salah satu dari 4 opsi di bawah: Paket resmi Tier 1-3 dengan spesifikasi standar terstandarisasi, atau Full Customization untuk alokasi hardware bebas.
                </p>
              </div>

              {/* 4 Cards Grid: Tier 1, Tier 2, Tier 3, Full Customization */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                {SIZING_OPTIONS.map((option) => {
                  const isSelected = activeTierKey === option.key;

                  return (
                    <div
                      key={option.key}
                      onClick={() => handleSelectTier(option.key)}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: isSelected ? `2px solid ${option.color}` : '1px solid var(--border-subtle)',
                        background: isSelected ? option.bg : '#ffffff',
                        boxShadow: isSelected 
                          ? `0 4px 14px ${option.color}26` 
                          : '0 1px 3px rgba(0,0,0,0.03)',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = option.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div>
                        {/* Title and Active Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '6px' }}>
                          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: option.color, margin: 0, lineHeight: 1.25 }}>
                            {option.name}
                          </h4>
                          {isSelected && (
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              background: option.color,
                              color: '#ffffff',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              <Check size={10} strokeWidth={3} />
                              <span>Aktif</span>
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.35', minHeight: '38px' }}>
                          {option.desc}
                        </p>

                        {/* Rates / Features Table */}
                        <div style={{
                          background: isSelected ? '#ffffff' : '#f8fafc',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isSelected ? `1px solid ${option.border}` : '1px solid #f1f5f9',
                          fontSize: '0.72rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          marginBottom: '10px'
                        }}>
                          {!option.isCustom ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>vCPU Core:</span>
                                <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(option.rates.cpuMonthly)}/bln</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>RAM (GB):</span>
                                <strong style={{ color: '#059669' }}>{formatCurrencyIDR(option.rates.ramMonthly)}/bln</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>SSD Enterprise:</span>
                                <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(option.rates.storageRates?.['STR-SSATA']?.monthly || 950)}/bln</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Setup (OTC):</span>
                                <strong style={{ color: '#64748b' }}>{formatCurrencyIDR(option.rates.setupFeeOTC)}</strong>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>vCPU:</span>
                                <strong style={{ color: '#7c3aed' }}>1 - 32 Core</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>RAM:</span>
                                <strong style={{ color: '#7c3aed' }}>1 - 64 GB</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Storage:</span>
                                <strong style={{ color: '#7c3aed' }}>10 - 500 GB</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Alokasi:</span>
                                <strong style={{ color: '#059669' }}>Fleksibel</strong>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Hardware Baseline */}
                        <div style={{
                          fontSize: '0.7rem',
                          color: '#475569',
                          background: isSelected ? 'rgba(255,255,255,0.7)' : '#f8fafc',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '4px'
                        }}>
                          <Cpu size={12} style={{ color: option.color, flexShrink: 0 }} />
                          <span style={{ lineHeight: 1.3 }}>
                            {!option.isCustom ? (
                              <>Spesifikasi: <strong>{option.cpu} vCPU • {option.ram} GB • {option.disk} GB</strong></>
                            ) : (
                              <>Spesifikasi: <strong>{isSelected ? `${cpuCores} vCPU • ${ramGB} GB • ${diskGB} GB` : 'Bebas Kustom'}</strong></>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Select / Applied Button */}
                      <button 
                        type="button" 
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ 
                          width: '100%', 
                          marginTop: '10px',
                          fontSize: '0.78rem',
                          background: isSelected ? option.color : '#ffffff',
                          color: isSelected ? '#ffffff' : 'var(--text-main)',
                          borderColor: isSelected ? option.color : '#cbd5e1'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTier(option.key);
                        }}
                      >
                        {isSelected ? '✓ Opsi Terpilih' : 'Pilih Paket Ini'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Conditionally Render: Preset Tier Summary OR Full Customization Specification Panel */}
              {activeTierKey !== 'CUSTOM' ? (
                /* Preset Tier Summary (No sliders) */
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '16px 18px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} style={{ color: activeTierDef.color }} />
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Paket Terpilih: {activeTierDef.name}
                      </span>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: activeTierDef.bg, 
                        color: activeTierDef.color, 
                        padding: '2px 8px', 
                        borderRadius: '6px',
                        fontWeight: 600,
                        border: `1px solid ${activeTierDef.border}`
                      }}>
                        Spesifikasi Standar Terkunci
                      </span>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}>
                      <span style={{ background: '#e0e7ff', color: '#1e3a8a', padding: '3px 8px', borderRadius: '6px' }}>
                        {cpuCores} vCPU
                      </span>
                      <span>•</span>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px' }}>
                        {ramGB} GB RAM
                      </span>
                      <span>•</span>
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px' }}>
                        {diskGB} GB Disk
                      </span>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={16} style={{ color: '#059669' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Estimasi Biaya Rutin Bulanan:
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#059669' }}>
                        ~{formatCurrencyIDR(estimatedCost.monthly)} / bulan
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        (~{formatCurrencyIDR(estimatedCost.hourly, 2)} / jam)
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Spesifikasi fixed resmi. Ingin custom CPU/RAM/Disk? Pilih opsi <strong>Full Customization</strong>.
                    </div>
                  </div>
                </div>
              ) : (
                /* Full Customization Specification Panel */
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #ddd6fe',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  boxShadow: '0 2px 12px rgba(124, 58, 237, 0.07)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f3e8ff',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: '#7c3aed' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4c1d95' }}>
                        Konfigurasi Spesifikasi Full Customization
                      </span>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: '#f5f3ff', 
                        color: '#7c3aed', 
                        padding: '2px 8px', 
                        borderRadius: '6px',
                        fontWeight: 600,
                        border: '1px solid #ddd6fe'
                      }}>
                        Kustom Bebas
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Acuan Tarif Katalog:</span>
                      <select
                        value={customRateBasis}
                        onChange={(e) => setCustomRateBasis(e.target.value)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.76rem',
                          borderRadius: '6px',
                          border: '1px solid #c4b5fd',
                          background: '#ffffff',
                          color: 'var(--text-main)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="TIER_1">Tier 1 (Internal / Hemat)</option>
                        <option value="TIER_2">Tier 2 (Standar PT)</option>
                        <option value="TIER_3">Tier 3 (Enterprise / HA)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* CPU Cores */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Cpu size={14} style={{ color: '#1e3a8a' }} />
                          <span>vCPU Processor Cores:</span>
                        </span>
                        <span style={{ color: '#1e3a8a', fontWeight: 700, fontSize: '0.88rem' }}>
                          {cpuCores} vCPU ({formatCurrencyIDR(cpuCores * activeTierDef.rates.cpuMonthly)} / bln)
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="32" 
                        value={cpuCores} 
                        onChange={(e) => handleCustomCpuChange(e.target.value)}
                        style={{ width: '100%', accentColor: '#1e3a8a' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[1, 2, 4, 8, 16, 32].map(cores => (
                            <button
                              key={cores}
                              type="button"
                              onClick={() => handleCustomCpuChange(cores)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                border: cpuCores === cores ? '1px solid #1e3a8a' : '1px solid #e2e8f0',
                                background: cpuCores === cores ? '#eff6ff' : '#f8fafc',
                                color: cpuCores === cores ? '#1e3a8a' : '#64748b',
                                fontWeight: cpuCores === cores ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {cores} vCPU
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Max 32 vCPU</span>
                      </div>
                    </div>

                    {/* RAM (GB) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Database size={14} style={{ color: '#0284c7' }} />
                          <span>RAM Memory (GB):</span>
                        </span>
                        <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '0.88rem' }}>
                          {ramGB} GB ({ramGB * 1024} MB) — {formatCurrencyIDR(ramGB * activeTierDef.rates.ramMonthly)} / bln
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="64" 
                        value={ramGB} 
                        onChange={(e) => handleCustomRamChange(e.target.value)}
                        style={{ width: '100%', accentColor: '#0284c7' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[2, 4, 8, 16, 32, 64].map(ram => (
                            <button
                              key={ram}
                              type="button"
                              onClick={() => handleCustomRamChange(ram)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                border: ramGB === ram ? '1px solid #0284c7' : '1px solid #e2e8f0',
                                background: ramGB === ram ? '#f0f9ff' : '#f8fafc',
                                color: ramGB === ram ? '#0284c7' : '#64748b',
                                fontWeight: ramGB === ram ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {ram} GB
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Max 64 GB</span>
                      </div>
                    </div>

                    {/* Disk (GB) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <HardDrive size={14} style={{ color: '#b45309' }} />
                          <span>Storage Disk (GB):</span>
                        </span>
                        <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.88rem' }}>
                          {diskGB} GB NVMe / SSD Enterprise ({formatCurrencyIDR(diskGB * (activeTierDef.rates.storageRates?.['STR-SSATA']?.monthly || 950))} / bln)
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="500" 
                        step="10" 
                        value={diskGB} 
                        onChange={(e) => handleCustomDiskChange(e.target.value)}
                        style={{ width: '100%', accentColor: '#b45309' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {[20, 50, 100, 200, 300, 500].map(disk => (
                            <button
                              key={disk}
                              type="button"
                              onClick={() => handleCustomDiskChange(disk)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.7rem',
                                borderRadius: '4px',
                                border: diskGB === disk ? '1px solid #b45309' : '1px solid #e2e8f0',
                                background: diskGB === disk ? '#fffbeb' : '#f8fafc',
                                color: diskGB === disk ? '#b45309' : '#64748b',
                                fontWeight: diskGB === disk ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {disk} GB
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Max 500 GB</span>
                      </div>
                    </div>
                  </div>

                  {/* Sizing & Billing Estimation Summary */}
                  <div style={{
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={16} style={{ color: '#059669' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Estimasi Biaya Rutin Bulanan:
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#059669' }}>
                        ~{formatCurrencyIDR(estimatedCost.monthly)} / bulan
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        (~{formatCurrencyIDR(estimatedCost.hourly, 2)} / jam)
                      </span>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}>
                      <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px' }}>
                        {cpuCores} vCPU
                      </span>
                      <span>•</span>
                      <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px' }}>
                        {ramGB} GB RAM
                      </span>
                      <span>•</span>
                      <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px' }}>
                        {diskGB} GB Disk
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGAN 2: IDENTITAS & LOKASI CLUSTER / NODE */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Server size={18} style={{ color: '#1e3a8a' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Langkah 2: Identitas & Penempatan Cluster Node
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Tentukan hostname VM dan pilih hypervisor cluster target untuk penempatan beban kerja komputasi.
                </p>
              </div>

              {/* VM Name */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Virtual Machine Name (Hostname) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. web-app-prod-01 atau db-postgres-node"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (stepError) setStepError('');
                  }}
                  autoFocus
                  required
                />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Gunakan karakter alfanumerik dan tanda hubung (-) tanpa spasi.
                </div>
              </div>

              {/* Cluster & Node Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Target Cluster ({clusters.length} Tersedia) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select 
                    className="form-select" 
                    value={selectedClusterId} 
                    onChange={(e) => handleClusterChange(e.target.value)}
                  >
                    {clusters.length === 0 ? (
                      <option value="">Tidak ada cluster terdaftar</option>
                    ) : (
                      clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — ({c.type})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Target Compute Node ({availableNodes.length} Tersedia) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select 
                    className="form-select" 
                    value={selectedNodeId} 
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    disabled={availableNodes.length === 0}
                  >
                    {availableNodes.length === 0 ? (
                      <option value="">Belum ada node pada cluster terpilih</option>
                    ) : (
                      availableNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.ip_address})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Node warning if cluster has no nodes */}
              {selectedCluster && availableNodes.length === 0 && (
                <div style={{ 
                  background: '#fef3c7', 
                  border: '1px solid #fde68a', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  color: '#92400e', 
                  fontSize: '0.82rem', 
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>
                    Cluster <strong>{selectedCluster.name}</strong> belum memiliki node compute terdaftar. Buka tab <strong>Clusters</strong> dan lakukan sinkronisasi node.
                  </span>
                </div>
              )}

              {/* Cluster Info Box */}
              {selectedCluster && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '0.82rem'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Informasi Infrastruktur Terpilih
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: 'var(--text-muted)' }}>
                    <div>
                      Tipe Hypervisor: <strong style={{ color: '#1e3a8a' }}>{selectedCluster.type}</strong>
                    </div>
                    <div>
                      Endpoint Host: <strong style={{ color: '#0f172a' }}>{selectedCluster.host || '127.0.0.1'}</strong>
                    </div>
                    <div>
                      Compute Node: <strong style={{ color: '#0f172a' }}>{selectedNodeObj?.name || 'Auto Node'}</strong>
                    </div>
                    <div>
                      IP Host Node: <strong style={{ color: '#0f172a' }}>{selectedNodeObj?.ip_address || '-'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGAN 3: SISTEM OPERASI & MEDIA BOOT (ISO) */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Disc size={18} style={{ color: '#1e3a8a' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Langkah 3: Sistem Operasi & Media Boot
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Pilih distro sistem operasi yang akan dipasang, lalu tentukan file ISO boot installer dari storage cluster untuk memilih versinya.
                </p>
              </div>

              {/* OS Profile Selection */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Profil Sistem Operasi (OS Type)
                </label>
                <select 
                  className="form-select" 
                  value={osType} 
                  onChange={(e) => setOsType(e.target.value)}
                >
                  {OS_OPTIONS.map((os) => (
                    <option key={os} value={os}>{os}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Distro sistem operasi dasar. Pilihan versi spesifik dipilih pada file ISO boot installer di bawah.
                </div>
              </div>

              {/* Boot / Installer ISO (CD-ROM) */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <Disc size={15} style={{ color: 'var(--ocean-blue)' }} />
                    <span>Boot / Installer ISO — Pilih Versi (CD-ROM Virtual)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchISOs(selectedClusterId, selectedNodeId)}
                    disabled={isLoadingIsos}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ocean-blue)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}
                    title="Pindai ulang ISO di datastore storage"
                  >
                    <RefreshCw size={12} className={isLoadingIsos ? 'spin' : ''} />
                    <span>{isLoadingIsos ? 'Memindai Storage...' : 'Scan Storage'}</span>
                  </button>
                </div>

                <select
                  className="form-select"
                  value={selectedIso}
                  onChange={(e) => setSelectedIso(e.target.value)}
                  disabled={isLoadingIsos}
                >
                  <option value="">Tanpa ISO (Blank Virtual Disk / PXE Boot)</option>
                  {filteredIsoList.map((iso) => {
                    const version = extractIsoVersion(iso.filename);
                    return (
                      <option key={iso.volid} value={iso.volid}>
                        {iso.filename} {version ? `(Versi ${version} • ${iso.storage} • ${iso.size_gb} GB)` : `(${iso.storage} • ${iso.size_gb} GB)`}
                      </option>
                    );
                  })}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                  {selectedIso ? (
                    <div style={{ fontSize: '0.76rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} />
                      <span>
                        ISO <strong>{selectedIsoObj?.filename || selectedIso}</strong> {extractIsoVersion(selectedIsoObj?.filename) ? `(Versi ${extractIsoVersion(selectedIsoObj.filename)})` : ''} akan dipasang ke virtual CD-ROM (ide2) sebagai boot installer {osType}.
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {filteredIsoList.length === 0 && !isLoadingIsos ? (
                        <span>Tidak ditemukan file ISO khusus <strong>{osType}</strong> di datastore storage.</span>
                      ) : (
                        <span>VM akan dibuat dengan virtual disk kosong tanpa installer CD-ROM (PXE Boot).</span>
                      )}
                    </div>
                  )}

                  {isoList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterByOS(!filterByOS)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1e3a8a',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {filterByOS ? `Tampilkan Semua ISO (${isoList.length})` : `Filter Khusus ${osType} (${filteredIsoList.length})`}
                    </button>
                  )}
                </div>
              </div>

              {/* OS Recommendations Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '0.8rem',
                marginTop: '16px'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Rekomendasi Konfigurasi Sistem Operasi ({osType}):
                </div>
                <div style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {osType === 'Windows Server' ? (
                    'Untuk Windows Server, pastikan ISO VirtIO driver terpasang untuk disk bus SCSI dan adapter jaringan vmbr.'
                  ) : osType === 'Alpine Linux' ? (
                    'Untuk Alpine Linux (musl/busybox), konfigurasi minimalis dengan serial console dan VirtIO SCSI sangat disarankan.'
                  ) : (
                    `Untuk sistem operasi Linux modern (${osType}), hypervisor akan otomatis mengoptimalkan kernel flags, ACPI virtualization, dan socket KVM paravirtualization (VirtIO SCSI).`
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGAN 4: JARINGAN & VLAN (802.1Q) */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Network size={18} style={{ color: '#1e3a8a' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Langkah 4: Konfigurasi Jaringan & VLAN 802.1Q
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Konfigurasi virtual network interface (vNIC), bridge switch, VLAN tagging, dan aturan firewall hypervisor.
                </p>
              </div>

              <div style={{
                background: '#f8fafc',
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Network size={16} style={{ color: '#1e3a8a' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Virtual Network Adapter (net0)
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={noNetwork}
                      onChange={(e) => setNoNetwork(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#1e3a8a' }}
                    />
                    <span>No network device (Air-gapped)</span>
                  </label>
                </div>

                {!noNetwork ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                      {/* Bridge */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bridge Interface</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. vmbr0"
                          value={networkBridge}
                          onChange={(e) => setNetworkBridge(e.target.value)}
                          required={!noNetwork}
                          style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                        />
                      </div>

                      {/* VLAN Tag */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>VLAN Tag (802.1Q)</label>
                          {vlanTag && parseInt(vlanTag, 10) > 0 && (
                            <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>
                              Tag: {vlanTag}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="4094"
                          className="form-input"
                          placeholder="Tanpa VLAN (e.g. 10, 20, 100)"
                          value={vlanTag}
                          onChange={(e) => setVlanTag(e.target.value)}
                          style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                        />
                      </div>

                      {/* Model */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>vNIC Device Model</label>
                        <select
                          className="form-select"
                          value={networkModel}
                          onChange={(e) => setNetworkModel(e.target.value)}
                          style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                        >
                          <option value="virtio">VirtIO (Paravirtualized)</option>
                          <option value="e1000">Intel E1000</option>
                          <option value="vmxnet3">VMware vmxnet3</option>
                          <option value="rtl8139">Realtek RTL8139</option>
                        </select>
                      </div>

                      {/* MAC Address */}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>MAC Address</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="auto (digenerate hypervisor)"
                          value={macAddress}
                          onChange={(e) => setMacAddress(e.target.value)}
                          style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    {/* Firewall & Live Preview */}
                    <div style={{
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={firewall}
                          onChange={(e) => setFirewall(e.target.checked)}
                          style={{ cursor: 'pointer', accentColor: '#1e3a8a' }}
                        />
                        <Shield size={14} style={{ color: firewall ? '#059669' : '#94a3b8' }} />
                        <span>Hypervisor Hardware Firewall</span>
                      </label>

                      <div style={{ fontSize: '0.74rem', background: '#e0e7ff', color: '#1e3a8a', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                        net0: {networkModel},bridge={networkBridge || 'vmbr0'}{vlanTag && parseInt(vlanTag, 10) > 0 ? `,tag=${vlanTag}` : ''}{firewall ? ',firewall=1' : ',firewall=0'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '8px 0' }}>
                    VM akan dibuat tanpa virtual network adapter (air-gapped / isolated VM).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BAGAN 5: REVIEW RINGKASAN & KONFIRMASI DEPLOY */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <CheckCircle2 size={18} style={{ color: '#059669' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Langkah 5: Ringkasan & Konfirmasi Provisioning
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                  Periksa seluruh parameter konfigurasi sebelum mengeksekusi pembuatan virtual machine pada hypervisor.
                </p>
              </div>

              {/* Review Card Table */}
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', 
                  color: '#ffffff', 
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={16} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                      {name || 'vm-untitled'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}>
                    {selectedCluster?.type || 'PROXMOX'} Hypervisor
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem' }}>
                  
                  {/* Row 1: Tier Package & Specs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Paket Tier:</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          background: activeTierDef.bg, 
                          color: activeTierDef.color, 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          border: `1px solid ${activeTierDef.border}`
                        }}>
                          {activeTierDef.name}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {cpuCores} vCPU • {ramGB} GB RAM • {diskGB} GB Storage
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Cluster & Node */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Penempatan:</span>
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>{selectedCluster?.name || 'Default Cluster'}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                        (Node: {selectedNodeObj?.name || 'Default Node'} - {selectedNodeObj?.ip_address})
                      </span>
                    </div>
                  </div>

                  {/* Row 3: OS & Boot */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sistem Operasi:</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--text-main)' }}>{osType}</strong>
                        {selectedIsoObj && extractIsoVersion(selectedIsoObj.filename) && (
                          <span style={{
                            fontSize: '0.72rem',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 700
                          }}>
                            Versi {extractIsoVersion(selectedIsoObj.filename)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: selectedIso ? '#059669' : 'var(--text-muted)', marginTop: '2px' }}>
                        {selectedIso ? `CD-ROM Boot Media: ${selectedIsoObj?.filename || selectedIso}` : 'Tanpa ISO (Blank Boot Disk)'}
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Networking */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Jaringan & VLAN:</span>
                    <div>
                      {!noNetwork ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                            Bridge: {networkBridge || 'vmbr0'}
                          </span>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 600 }}>
                            {vlanTag && parseInt(vlanTag, 10) > 0 ? `VLAN Tag: ${vlanTag}` : 'No VLAN (Native)'}
                          </span>
                          <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.76rem' }}>
                            Model: {networkModel}
                          </span>
                          <span style={{ background: firewall ? '#ecfdf5' : '#fef2f2', color: firewall ? '#059669' : '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                            Firewall: {firewall ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Tidak ada virtual network adapter (Isolated)</span>
                      )}
                    </div>
                  </div>

                  {/* Row 5: Billing Estimation */}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'baseline', gap: '10px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Estimasi Sewa:</span>
                    <div>
                      <strong style={{ color: '#059669', fontSize: '0.9rem' }}>
                        {formatCurrencyIDR(estimatedCost.monthly)} / bulan
                      </strong>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        (+ Setup OTC {formatCurrencyIDR(estimatedCost.otc)} di bulan ke-1)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready banner */}
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={18} style={{ color: '#059669', flexShrink: 0 }} />
                <span>
                  Konfigurasi lengkap dan siap diprovisioning. Klik <strong>Deploy Virtual Machine</strong> untuk mengirim instruksi provisioning langsung ke cluster hypervisor.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with Bagan / Stepper Navigation Controls */}
        <div className="modal-footer" style={{ 
          padding: '14px 24px', 
          background: '#f8fafc', 
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left: Cancel button */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
            style={{ fontSize: '0.84rem' }}
          >
            Batal
          </button>

          {/* Center: Step Indicator */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Langkah {currentStep} dari {STEPS.length}
          </div>

          {/* Right: Back & Next / Deploy buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {currentStep > 1 && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleBack}
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
              >
                <ChevronLeft size={16} />
                <span>Kembali</span>
              </button>
            )}

            {currentStep < STEPS.length ? (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleNext}
                disabled={clusters.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
              >
                <span>Lanjut</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSubmit}
                disabled={isSubmitting || clusters.length === 0}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.84rem',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#047857',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Provisioning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Deploy Virtual Machine</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
