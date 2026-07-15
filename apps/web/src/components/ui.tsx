import type { ButtonHTMLAttributes, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  const classes = [
    'fz-btn',
    `fz-btn--${variant}`,
    size === 'lg' ? 'fz-btn--lg' : '',
    className,
  ].filter(Boolean).join(' ');
  return <button className={classes} {...rest} />;
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return (
    <span className={`fz-chip${tone === 'neutral' ? '' : ` fz-chip--${tone}`}`}>{children}</span>
  );
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="fz-stat">
      <span className="fz-kicker">{label}</span>
      <span className="fz-stat__value" style={accent ? { color: 'var(--accent)' } : undefined}>
        {value}
      </span>
      {sub ? <span className="fz-stat__sub">{sub}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressRing — SVG radial gauge for 0–100 scores
// ---------------------------------------------------------------------------

export function ProgressRing({
  value,
  size = 120,
  stroke = 9,
  label,
  display,
}: {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  label?: string;
  display?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="fz-ring" style={{ width: size }} role="img" aria-label={`${label ?? 'Score'}: ${Math.round(clamped)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }}
        />
      </svg>
      <div className="fz-ring__center">
        <span className="fz-ring__value">{display ?? Math.round(clamped)}</span>
        {label ? <span className="fz-ring__label">{label}</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meter — horizontal score bar
// ---------------------------------------------------------------------------

export function Meter({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="fz-meter" role="img" aria-label={`${label}: ${Math.round(value)} of ${max}`}>
      <div className="fz-meter__head">
        <span>{label}</span>
        <span className="fz-meter__num">{Math.round(value)}</span>
      </div>
      <div className="fz-meter__track">
        <div className="fz-meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="fz-empty">
      <div className="fz-empty__glyph" aria-hidden>
        <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
          <path d="M9 24 L16 7 L19 15 L23 15" stroke="var(--ink-faint)" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader block
// ---------------------------------------------------------------------------

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="fz-skeleton" style={{ height, width }} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Integrity badge for assessments
// ---------------------------------------------------------------------------

export function IntegrityChip({ integrity }: { integrity: 'verified' | 'tampered' | 'unverified' }) {
  if (integrity === 'verified') return <Chip tone="success">✓ Verified</Chip>;
  if (integrity === 'tampered') return <Chip tone="danger">⚠ Tampered</Chip>;
  return <Chip tone="warning">Pending</Chip>;
}
