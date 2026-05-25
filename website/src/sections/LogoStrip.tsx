type Card = {
  name: string;
  org: string;
  color: string;
  desc: string;
  soon?: boolean;
};

const subscriptions: Card[] = [
  {
    name: 'Claude',
    org: 'Anthropic Max',
    color: 'oklch(0.74 0.15 55)',
    desc: 'Planning, refactors, reviews',
  },
  {
    name: 'Cursor',
    org: 'Cursor Pro',
    color: 'oklch(0.70 0.16 290)',
    desc: 'Inline edits, autocomplete',
  },
  {
    name: 'Codex',
    org: 'ChatGPT Pro',
    color: 'oklch(0.72 0.16 150)',
    desc: 'Scaffolds, one-shots',
  },
  {
    name: 'More',
    org: 'soon',
    color: 'oklch(0.55 0.012 255)',
    desc: 'Gemini, local LLMs, OSS adapters',
    soon: true,
  },
];

const integrations: Card[] = [
  {
    name: 'GitHub',
    org: 'PRs + CI',
    color: 'oklch(0.86 0.005 250)',
    desc: 'PRs, checks, diff comments',
  },
  {
    name: 'VS Code',
    org: 'soon',
    color: 'oklch(0.69 0.11 238)',
    desc: 'Open worktree in editor, jump-to-file',
    soon: true,
  },
  {
    name: 'Linear',
    org: 'soon',
    color: 'oklch(0.70 0.16 290)',
    desc: 'Link issues to sessions, sync status',
    soon: true,
  },
  {
    name: 'Slack',
    org: 'soon',
    color: 'oklch(0.76 0.13 78)',
    desc: 'Notify on PR ready, budget alerts',
    soon: true,
  },
];

export function LogoStrip() {
  return (
    <section className="relative border-y border-border-soft/60 py-20">
      <div className="mx-auto max-w-6xl space-y-14 px-6">
        <Row eyebrow="Subscriptions you already have" cards={subscriptions} />
        <Row eyebrow="Integrations" cards={integrations} />
      </div>
    </section>
  );
}

function Row({ eyebrow, cards }: { eyebrow: string; cards: Card[] }) {
  return (
    <div>
      <p className="pb-7 text-center text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((p) => (
          <div
            key={p.name + p.org}
            className={[
              'rounded-lg border border-border-soft bg-subtle p-4',
              p.soon ? 'opacity-65' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
                {p.name}
              </span>
              <span
                className={[
                  'ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]',
                  p.soon
                    ? 'bg-muted text-muted-foreground'
                    : 'border border-border-soft bg-elevated text-muted-foreground',
                ].join(' ')}
              >
                {p.org}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
