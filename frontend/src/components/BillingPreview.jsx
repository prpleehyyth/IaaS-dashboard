import React, { useState, useEffect } from 'react';
import { Receipt, DollarSign, Clock, Cpu, Database, HardDrive, CheckCircle2, FileText, Sparkles, ArrowRight } from 'lucide-react';
import { api } from '../api/client';

export default function BillingPreview() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetering() {
      try {
        const data = await api.getMeteringSummary();
        setSummaries(data || []);
      } catch (err) {
        console.error("Failed to load metering:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMetering();
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Maritime Telemetry & Billing Readiness</h1>
          <span style={{ 
            fontSize: '0.82rem', 
            background: '#eff6ff', 
            color: '#1e3a8a', 
            border: '1px solid #bfdbfe', 
            padding: '4px 12px', 
            borderRadius: '8px', 
            fontWeight: 700 
          }}>
            Ready for Rating Schedule
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
          Continuous time-series consumption telemetry tracking active workloads across 4 hybrid clusters.
        </p>
      </div>

      {/* Architecture Alert / Readiness Card */}
      <div className="glass-panel" style={{ 
        padding: '22px 26px', 
        marginBottom: '30px', 
        borderLeft: '4px solid var(--accent-gold)', 
        background: '#fffbeb' 
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ 
            padding: '10px', 
            borderRadius: '10px', 
            background: '#fef3c7', 
            color: '#b45309',
            border: '1px solid #fde68a'
          }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Maritime Rating Engine Telemetry Hook Active
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.6 }}>
              The backend telemetry engine continuously samples usage (<code style={{ color: '#1e3a8a', fontFamily: 'var(--font-mono)' }}>resource_metering_samples</code>) tracking runtime vCPU hours, RAM GB hours, and Storage allocation. As soon as you supply the <strong>Billing Plan Document</strong>, we can instantly apply your exact rate schedules, tiers, and automated naval statements!
            </p>
          </div>
        </div>
      </div>

      {/* Telemetry Summary Cards per Tenant */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginBottom: '34px' }}>
        {loading ? (
          <div style={{ padding: '40px', color: 'var(--text-dim)', textAlign: 'center' }}>Calculating telemetry samples...</div>
        ) : (
          summaries.map((s) => (
            <div key={s.tenant_id} className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>{s.tenant_name}</h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Telemetry Horizon: Rolling 24 Hours
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>ESTIMATED USAGE</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                    ${s.estimated_cost.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Resource Counters Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '12px', 
                background: '#f8fafc', 
                padding: '16px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-subtle)' 
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                    <Cpu size={13} color="#1e3a8a" />
                    <span>vCPU HOURS</span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                    {s.total_vcpu_hours.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>hrs</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                    <Database size={13} color="#0f172a" />
                    <span>RAM GB HOURS</span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {s.total_ram_gb_hours.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>hrs</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                    <HardDrive size={13} color="#b45309" />
                    <span>STORAGE DAYS</span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                    {s.total_disk_gb_days.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>GB-d</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={15} color="#059669" />
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{s.active_vm_count} Active Metered Vessels</span>
                </div>
                <div style={{ color: 'var(--text-dim)' }}>
                  Continuous 1-hour resolution
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Billing Integration Roadmap */}
      <div className="glass-panel" style={{ padding: '26px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <FileText size={20} color="#1e3a8a" />
          <span>Billing Schedule Integration Checklist</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} />
              <span>1. Telemetry Collector</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Completed. Gathers per-second and hourly resource data for all VMware and Proxmox VMs.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} />
              <span>2. Multi-Tenant Aggregator</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Completed. Sums runtime vCPU-hours, RAM GB-hours, and Disk-days per tenant organization.
            </p>
          </div>

          <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 700, fontSize: '0.9rem' }}>
              <Clock size={16} />
              <span>3. Rate Calculator & Invoicing</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Ready. Awaiting your Billing Plan Document to apply pricing tiers, prepaid balances, or PDF invoices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
