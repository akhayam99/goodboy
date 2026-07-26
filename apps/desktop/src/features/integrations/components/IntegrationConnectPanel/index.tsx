import type { ReactNode } from 'react';
import { IntegrationGlyph, type IntegrationGlyphProvider } from '../IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly description: string;
  readonly children: ReactNode;
};

export const IntegrationConnectPanel = ({ provider, description, children }: Props) => (
  <div className="w-full max-w-md rounded-lg border border-border-soft bg-background p-5 shadow-sm">
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <IntegrationGlyph provider={provider} />
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  </div>
);
