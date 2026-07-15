import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bars, Sparkline, TrendChart } from './charts';

const points = [
  { x: 1, y: 40, ciLow: 37, ciHigh: 43 },
  { x: 2, y: 44, ciLow: 41, ciHigh: 47 },
  { x: 3, y: 42, ciLow: 39, ciHigh: 45 },
];

describe('charts', () => {
  it('renders a TrendChart svg with an accessible name', () => {
    render(<TrendChart points={points} ariaLabel="Jump trend" />);
    expect(screen.getByRole('img', { name: 'Jump trend' })).toBeInTheDocument();
  });

  it('renders one dot per point', () => {
    const { container } = render(<TrendChart points={points} />);
    expect(container.querySelectorAll('circle')).toHaveLength(points.length);
  });

  it('renders nothing for an empty series', () => {
    const { container } = render(<TrendChart points={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders Bars with labels', () => {
    render(<Bars data={[{ label: 'Power', value: 60 }, { label: 'Coord', value: 80 }]} ariaLabel="Scores" />);
    const svg = screen.getByRole('img', { name: 'Scores' });
    expect(svg).toBeInTheDocument();
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('renders a Sparkline path for 2+ values and a dash otherwise', () => {
    const { container, rerender } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector('path')).not.toBeNull();
    rerender(<Sparkline values={[1]} />);
    expect(container.querySelector('path')).toBeNull();
  });
});
