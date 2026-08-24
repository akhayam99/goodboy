import type { ReactNode } from 'react';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly description: string;
  readonly children: ReactNode;
  readonly headingLevel?: 2 | 3;
};

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

export const IntegrationConnectPanel = ({
  provider,
  description,
  children,
  headingLevel,
}: Props) => {
  const Heading = headingLevel == null ? 'p' : HEADING_TAG[headingLevel];
  return (
    <section className="m-auto flex w-full min-w-0 max-w-md flex-col gap-3 rounded-lg border border-border-soft bg-background p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <IntegrationGlyph provider={provider} size={18} />
        <Heading className="text-sm font-semibold text-foreground">
          Connect {integrationLabel({ provider })}
        </Heading>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </section>
  );
};
