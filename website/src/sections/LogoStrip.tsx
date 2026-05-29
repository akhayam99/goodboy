import type { CSSProperties } from 'react';
import { useInView } from '../components/Reveal';

type Card = {
  name: string;
  color: string;
  desc: string;
  soon?: boolean;
};

const subscriptions: Card[] = [
  { name: 'Claude', color: 'oklch(0.74 0.15 55)', desc: 'Planning, refactors, reviews' },
  { name: 'Cursor', color: 'oklch(0.70 0.16 290)', desc: 'Inline edits, autocomplete' },
  { name: 'Codex', color: 'oklch(0.72 0.16 150)', desc: 'Scaffolds, one-shots' },
  { name: 'Gemini', color: 'oklch(0.72 0.16 240)', desc: 'Long context, multimodal' },
];

const integrations: Card[] = [
  { name: 'GitHub', color: 'oklch(0.86 0.005 250)', desc: 'PRs, checks, diff comments, resolvers' },
  { name: 'Linear', color: 'oklch(0.62 0.18 275)', desc: 'Issue picker, goal auto-fill' },
  { name: 'GitLab', color: 'oklch(0.74 0.15 55)', desc: 'MRs, pipelines, threads', soon: true },
  { name: 'Slack', color: 'oklch(0.76 0.13 78)', desc: 'PR-ready and budget alerts', soon: true },
];

const MASK: CSSProperties = {
  WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
  maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
};

export function LogoStrip() {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      className={`reveal-group relative border-y border-border-soft/60 py-20 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-6xl space-y-12 px-6">
        <Row eyebrow="Bring your own subscription" cards={subscriptions} />
        <Row eyebrow="Integrations" cards={integrations} reverse />
      </div>
    </section>
  );
}

function Row({ eyebrow, cards, reverse }: { eyebrow: string; cards: Card[]; reverse?: boolean }) {
  return (
    <div className="reveal">
      <p className="pb-7 text-center text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="marquee-mask overflow-hidden" style={MASK}>
        <div
          className="marquee gap-3"
          style={reverse ? { animationDirection: 'reverse' } : undefined}
        >
          {[...cards, ...cards].map((p, i) => (
            <CardItem key={`${p.name}-${i}`} card={p} aria-hidden={i >= cards.length} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardItem({ card, ...rest }: { card: Card } & { 'aria-hidden'?: boolean }) {
  return (
    <div
      {...rest}
      className={[
        'w-[230px] shrink-0 rounded-lg border border-border-soft bg-subtle p-4',
        card.soon ? 'opacity-65' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: card.color }}
          aria-hidden
        />
        <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
          {card.name}
        </span>
        {card.soon ? (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            soon
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{card.desc}</p>
    </div>
  );
}
