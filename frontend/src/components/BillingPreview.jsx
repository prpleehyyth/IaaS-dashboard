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
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Resource Metering & Billing Readiness</h1>
          <span style={{ fontSize: '0.8rem', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
            Ready for Billing Document
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Real-time time-series resource consumption telemetry tracking active workloads across 4 clusters.
        </p>
      </div>

      {/* Architecture Alert / Readiness Card */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '28px', borderLeft: '4px solid var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Billing Engine Integration Hook Active
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              The backend telemetry engine continuously writes hourly usage samples (<code style={{ color: 'var(--accent-cyan)' }}>resource_metering_samples</code>) tracking runtime vCPU hours, RAM GB hours, and Storage GB allocation. As soon as you provide the <strong>Billing Plan Document</strong>, we can instantly apply your exact rating rules, tiers, tax calculations, and automated monthly invoice generation!
            </p>
          </div>
        </div>
      </div>

      {/* Telemetry Summary Cards per Tenant */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {loading ? (
          <div style={{ padding: '40px', color: 'var(--text-dim)', textAlign: 'center' }}>Calculating telemetry samples...</div>
        ) : (
          summaries.map((s) => (
            <div key={s.tenant_id} className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{s.tenant_name}</h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Tracking Period: Last 24 Hours
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ESTIMATED USAGE</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-display)' }}>
                    ${s.estimated_cost.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Resource Counters Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <Cpu size={12} color="var(--accent-cyan)" />
                    <span>vCPU HOURS</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                    {s.total_vcpu_hours.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>hrs</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <Database size={12} color="var(--accent-emerald)" />
                    <span>RAM GB HOURS</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                    {s.total_ram_gb_hours.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>hrs</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <HardDrive size={12} color="var(--accent-amber)" />
                    <span>STORAGE DAYS</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                    {s.total_disk_gb_days.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>GB-d</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} color="var(--accent-emerald)" />
                  <span>{s.active_vm_count} Active Metered Virtual Machines</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Hourly resolution
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Billing Integration Roadmap */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--accent-cyan)" />
          <span>Billing Plan Document Integration Checklist</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} />
              <span>1. Telemetry Collector</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              Completed. Gathers per-second and hourly resource data for all VMware and Proxmox VMs.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} />
              <span>2. Multi-Tenant Aggregator</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              Completed. Sums runtime vCPU-hours, RAM GB-hours, and Disk-days per tenant organization.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.9rem' }}>
              <Clock size={16} />
              <span>3. Rate Calculator & Invoicing</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              Ready. Awaiting your Billing Plan Document to apply pricing tiers, prepaid balances, or PDF invoices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
