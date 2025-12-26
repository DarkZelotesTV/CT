import React from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, SignalHigh } from 'lucide-react';

export type DirectionalDebugStats = {
  bitrateKbps: number | null;
  packetLossPercent: number | null;
  jitterMs: number | null;
  rttMs: number | null;
};

export type MediasoupDebugStats = {
  outbound: DirectionalDebugStats | null;
  inbound: DirectionalDebugStats | null;
  updatedAt: number | null;
  consumerCount: number;
};

type StatCellProps = {
  label: string;
  value: number | null;
  unit: string;
  precision?: number;
};

const StatCell = ({ label, value, unit, precision = 0 }: StatCellProps) => {
  const formatted =
    value === null || Number.isNaN(value)
      ? '–'
      : value >= 100
        ? Math.round(value).toString()
        : value.toFixed(precision);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[color:var(--color-text)]">
        {formatted}
        <span className="text-[11px] ml-1 text-[color:var(--color-text-muted)]">{unit}</span>
      </span>
    </div>
  );
};

type StatGroupProps = {
  icon: React.ReactNode;
  label: string;
  accentTextClass: string;
  accentBgClass: string;
  stats: DirectionalDebugStats | null;
  secondaryLabel?: string;
};

const StatGroup = ({ icon, label, accentTextClass, accentBgClass, stats, secondaryLabel }: StatGroupProps) => (
  <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70 backdrop-blur-sm p-3 shadow-glass">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text)]">
        <span className={`p-1.5 rounded-lg ${accentBgClass} ${accentTextClass}`}>{icon}</span>
        {label}
      </div>
      {secondaryLabel && (
        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-[color:var(--color-surface-alt)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)]">
          {secondaryLabel}
        </span>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3 mt-3">
      <StatCell label="Bitrate" value={stats?.bitrateKbps ?? null} unit="kbps" />
      <StatCell label="Loss" value={stats?.packetLossPercent ?? null} unit="%" precision={1} />
      <StatCell label="Jitter" value={stats?.jitterMs ?? null} unit="ms" precision={1} />
      <StatCell label="RTT" value={stats?.rttMs ?? null} unit="ms" precision={1} />
    </div>
  </div>
);

type DebugOverlayProps = {
  stats: MediasoupDebugStats;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
};

export const MediasoupDebugOverlay: React.FC<DebugOverlayProps> = ({ stats, connectionState }) => {
  const hasStats = Boolean(stats.inbound || stats.outbound);
  if (!hasStats && connectionState !== 'connected') return null;

  return (
    <div className="fixed bottom-24 right-4 z-[80] pointer-events-none">
      <div className="pointer-events-auto w-80 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 shadow-2xl backdrop-blur-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text)]">
            <Activity size={16} className="text-[color:var(--color-text-muted)]" />
            Voice Debug Panel
          </div>
          <div
            className={`text-[10px] px-2 py-1 rounded-full border ${connectionState === 'connected' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-amber-500/40 bg-amber-500/15 text-amber-100'}`}
          >
            {connectionState === 'connected' ? 'Verbunden' : 'Aktualisiere'}
          </div>
        </div>

        <StatGroup
          icon={<ArrowUpRight size={14} />}
          label="Senden"
          accentTextClass="text-emerald-400"
          accentBgClass="bg-emerald-400/15"
          stats={stats.outbound}
        />
        <StatGroup
          icon={<ArrowDownLeft size={14} />}
          label="Empfang"
          accentTextClass="text-sky-400"
          accentBgClass="bg-sky-400/15"
          stats={stats.inbound}
          secondaryLabel={`${stats.consumerCount} Streams`}
        />

        <div className="flex items-center justify-between text-[11px] text-[color:var(--color-text-muted)]">
          <div className="flex items-center gap-1">
            <SignalHigh size={12} />
            Paketverlust, Jitter, RTT und Bitrate werden alle 2s aktualisiert.
          </div>
          {stats.updatedAt && <span className="text-[10px]">{new Date(stats.updatedAt).toLocaleTimeString()}</span>}
        </div>
      </div>
    </div>
  );
};
