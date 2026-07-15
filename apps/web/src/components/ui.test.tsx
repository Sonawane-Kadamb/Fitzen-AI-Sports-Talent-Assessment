import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Chip, EmptyState, IntegrityChip, Meter, ProgressRing, Stat } from './ui';

describe('UI components', () => {
  it('renders Button variants with the design-system classes', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn).toHaveClass('fz-btn', 'fz-btn--ghost');
  });

  it('renders Stat label and value', () => {
    render(<Stat label="Personal best" value="52.3 cm" sub="vertical jump" />);
    expect(screen.getByText('Personal best')).toBeInTheDocument();
    expect(screen.getByText('52.3 cm')).toBeInTheDocument();
    expect(screen.getByText('vertical jump')).toBeInTheDocument();
  });

  it('exposes ProgressRing value via an accessible label', () => {
    render(<ProgressRing value={73.4} label="Potential" />);
    expect(screen.getByRole('img', { name: /Potential: 73 out of 100/ })).toBeInTheDocument();
  });

  it('clamps ProgressRing to the 0–100 range', () => {
    render(<ProgressRing value={250} label="Overflow" />);
    expect(screen.getByRole('img', { name: /Overflow: 100 out of 100/ })).toBeInTheDocument();
  });

  it('renders Meter with rounded numeric display', () => {
    render(<Meter label="Explosiveness" value={66.6} />);
    expect(screen.getByText('Explosiveness')).toBeInTheDocument();
    expect(screen.getByText('67')).toBeInTheDocument();
  });

  it('maps integrity states to the right tone', () => {
    const { rerender } = render(<IntegrityChip integrity="verified" />);
    expect(screen.getByText(/Verified/)).toHaveClass('fz-chip--success');
    rerender(<IntegrityChip integrity="tampered" />);
    expect(screen.getByText(/Tampered/)).toHaveClass('fz-chip--danger');
  });

  it('renders Chip tones', () => {
    render(<Chip tone="warning">Offline</Chip>);
    expect(screen.getByText('Offline')).toHaveClass('fz-chip--warning');
  });

  it('renders EmptyState with title, body and action', () => {
    render(<EmptyState title="Nothing yet" body="Do a jump." action={<button>Go</button>} />);
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });
});
