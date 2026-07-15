import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { Chip, Skeleton } from '../components/ui';
import { api, type BadgeWithDate } from '../lib/api';
import { formatDate } from '../lib/format';

const TIER_TONES = { bronze: 'neutral', silver: 'neutral', gold: 'warning', platinum: 'accent' } as const;
const GLYPHS: Record<string, string> = {
  rocket: '🚀', flame: '🔥', 'trending-up': '📈', zap: '⚡', bolt: '💪',
  scale: '⚖️', target: '🎯', calendar: '📅', award: '🏆', sparkles: '✨',
};

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeWithDate[] | null>(null);

  useEffect(() => {
    api.badges().then(({ badges }) => setBadges(badges)).catch(() => setBadges([]));
  }, []);

  const earned = badges?.filter((b) => b.earned) ?? [];

  return (
    <Shell title="Badges" actions={badges ? <Chip tone="accent">{earned.length} / {badges.length} earned</Chip> : undefined}>
      {!badges ? (
        <div className="fz-card"><Skeleton height={220} /></div>
      ) : (
        <div className="fz-badge-grid">
          {badges.map((badge) => (
            <div key={badge.id} className={`fz-card fz-badge-card${badge.earned ? '' : ' fz-badge-card--locked'}`}>
              <div className="fz-badge-card__glyph" aria-hidden>{GLYPHS[badge.icon] ?? '🏅'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                <h4>{badge.name}</h4>
                <Chip tone={TIER_TONES[badge.tier]}>{badge.tier}</Chip>
              </div>
              <p>{badge.description}</p>
              {badge.earned ? (
                <Chip tone="success">Earned{badge.earnedAt ? ` · ${formatDate(badge.earnedAt)}` : ''}</Chip>
              ) : (
                <div className="fz-meter" aria-label={`${Math.round(badge.progress * 100)}% progress`}>
                  <div className="fz-meter__track">
                    <div className="fz-meter__fill" style={{ width: `${badge.progress * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
