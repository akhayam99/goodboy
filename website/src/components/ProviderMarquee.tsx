import type { CSSProperties } from 'react';

type Provider = {
  name: string;
  color: string;
  desc: string;
};

const providers: Provider[] = [
  { name: 'Claude', color: 'oklch(0.74 0.15 55)', desc: 'Planning, refactors, reviews' },
  { name: 'Cursor', color: 'oklch(0.70 0.16 290)', desc: 'Inline edits, autocomplete' },
  { name: 'Codex', color: 'oklch(0.72 0.16 150)', desc: 'Scaffolds, one-shots' },
  { name: 'Gemini', color: 'oklch(0.72 0.16 240)', desc: 'Long context, multimodal' },
];

const MASK: CSSProperties = {
  WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
  maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
};

export function ProviderMarquee() {
  return (
    <div className="overflow-hidden" style={MASK}>
      <div className="marquee gap-3">
        {[...providers, ...providers].map((provider, i) => (
          <Card
            key={`${provider.name}-${i}`}
            provider={provider}
            aria-hidden={i >= providers.length}
          />
        ))}
      </div>
    </div>
  );
}

function Card({ provider, ...rest }: { provider: Provider } & { 'aria-hidden'?: boolean }) {
  return (
    <div
      {...rest}
      className="w-[220px] shrink-0 rounded-lg border border-border-soft bg-subtle p-4 text-left"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: provider.color }}
          aria-hidden
        />
        <span className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
          {provider.name}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{provider.desc}</p>
    </div>
  );
}
