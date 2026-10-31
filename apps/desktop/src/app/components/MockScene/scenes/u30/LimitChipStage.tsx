import { useEffect, useRef } from 'react';
import { AutoLimitChip } from '../../../../../features/auto/AutoLimitChip';

const noop = (): void => undefined;

const DEFAULT_LIMIT = {
  usd: 5,
  isFromSession: false,
  isDefault: true,
  defaultUsd: 5,
  defaultFrom: 'auto',
  change: noop,
} as const;

const TYPED_LIMIT = {
  usd: 8,
  isFromSession: false,
  isDefault: false,
  defaultUsd: 5,
  defaultFrom: 'run',
  change: noop,
} as const;

const TIERS = 'Session $0 of $20.00 · Claude $41.20 of $200.00 this month';

const OPEN_LIMIT = { ...TYPED_LIMIT, tiers: TIERS } as const;

export const LimitChipStage = () => {
  const openRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    openRef.current?.querySelector<HTMLButtonElement>('button')?.click();
  }, []);

  return (
    <main className="flex h-screen items-start justify-center bg-background text-foreground">
      <div className="flex w-full max-w-prose flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <AutoLimitChip limit={DEFAULT_LIMIT} kind="autoAgent" isDisabled={false} />
          <span className="text-meta text-muted-foreground">From the default</span>
        </div>
        <div className="flex items-center gap-2">
          <AutoLimitChip limit={TYPED_LIMIT} kind="preset" isDisabled={false} />
          <span className="text-meta text-muted-foreground">Typed</span>
        </div>
        <div ref={openRef} className="flex items-center gap-2">
          <AutoLimitChip limit={OPEN_LIMIT} kind="orchestrated" isDisabled={false} />
          <span className="text-meta text-muted-foreground">Open</span>
        </div>
      </div>
    </main>
  );
};
