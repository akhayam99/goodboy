type Card = {
  name: string;
  org: string;
  color: string;
  desc: string;
  accent: string;
  border: string;
  soon?: boolean;
};

const subscriptions: Card[] = [
  {
    name: 'Claude',
    org: 'Anthropic Max',
    color: 'oklch(0.74 0.15 55)',
    desc: 'Planning, refactors, reviews',
    accent: 'oklch(0.74 0.15 55 / 0.12)',
    border: 'oklch(0.74 0.15 55 / 0.25)',
  },
  {
    name: 'Cursor',
    org: 'Cursor Pro',
    color: 'oklch(0.70 0.16 290)',
    desc: 'Inline edits, autocomplete',
    accent: 'oklch(0.70 0.16 290 / 0.12)',
    border: 'oklch(0.70 0.16 290 / 0.25)',
  },
  {
    name: 'Codex',
    org: 'ChatGPT Pro',
    color: 'oklch(0.72 0.16 150)',
    desc: 'Scaffolds, one-shots',
    accent: 'oklch(0.72 0.16 150 / 0.12)',
    border: 'oklch(0.72 0.16 150 / 0.25)',
  },
  {
    name: 'More',
    org: 'soon',
    color: 'oklch(0.55 0.012 255)',
    desc: 'Gemini, local LLMs, OSS adapters',
    accent: 'oklch(0.30 0.010 255 / 0.6)',
    border: 'oklch(0.36 0.012 255 / 0.7)',
    soon: true,
  },
];

const integrations: Card[] = [
  {
    name: 'GitHub',
    org: 'PRs + CI',
    color: 'oklch(0.86 0.005 250)',
    desc: 'PRs, checks, diff comments',
    accent: 'oklch(0.86 0.005 250 / 0.08)',
    border: 'oklch(0.86 0.005 250 / 0.20)',
  },
  {
    name: 'VS Code',
    org: 'soon',
    color: 'oklch(0.69 0.11 238)',
    desc: 'Open worktree in editor, jump-to-file',
    accent: 'oklch(0.30 0.010 255 / 0.6)',
    border: 'oklch(0.36 0.012 255 / 0.7)',
    soon: true,
  },
  {
    name: 'Linear',
    org: 'soon',
    color: 'oklch(0.70 0.16 290)',
    desc: 'Link issues to sessions, sync status',
    accent: 'oklch(0.30 0.010 255 / 0.6)',
    border: 'oklch(0.36 0.012 255 / 0.7)',
    soon: true,
  },
  {
    name: 'Slack',
    org: 'soon',
    color: 'oklch(0.76 0.13 78)',
    desc: 'Notify on PR ready, budget alerts',
    accent: 'oklch(0.30 0.010 255 / 0.6)',
    border: 'oklch(0.36 0.012 255 / 0.7)',
    soon: true,
  },
];

export function LogoStrip() {
  return (
    <section className="py-20 border-y border-[oklch(0.36_0.012_255_/_0.4)]">
      <div className="mx-auto max-w-7xl px-6 space-y-12">
        <Row eyebrow="Subscriptions you already have" cards={subscriptions} />
        <Row eyebrow="Integrations" cards={integrations} />
      </div>
    </section>
  );
}

function Row({ eyebrow, cards }: { eyebrow: string; cards: Card[] }) {
  return (
    <div>
      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[oklch(0.55_0.015_255)] pb-6">
        {eyebrow}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((p) => (
          <div
            key={p.name + p.org}
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              background: p.accent,
              border: `1px solid ${p.border}`,
              opacity: p.soon ? 0.7 : 1,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-[15px] font-semibold text-[oklch(0.94_0.006_90)]">
                {p.name}
              </span>
              <span
                className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: p.soon ? 'oklch(0.65 0.015 255)' : p.color,
                  background: p.soon ? 'oklch(0.30 0.010 255)' : p.accent,
                }}
              >
                {p.org}
              </span>
            </div>
            <p className="text-[12.5px] text-[oklch(0.72_0.012_255)] leading-snug">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
