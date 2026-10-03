import { useState } from 'react';
import { Popover } from '@goodboy/ui';
import { LinkWorkPicker } from '../../../../features/session/components/SessionOverviewPane/LinkWorkPicker';
import type { LinkWorkItem } from '../../../../features/session/components/SessionOverviewPane/linkWorkRows';

const NOW = Date.now();

const item = ({
  identifier,
  title,
  status,
  hoursAgo,
}: {
  readonly identifier: string;
  readonly title: string;
  readonly status: string;
  readonly hoursAgo: number;
}): LinkWorkItem => ({
  key: `linear:${identifier}`,
  status,
  updatedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  task: {
    provider: 'linear',
    externalId: `mock-link-${identifier}`,
    identifier,
    url: `https://example.invalid/linear/${identifier}`,
    title,
  },
});

const ITEMS: ReadonlyArray<LinkWorkItem> = [
  item({
    identifier: 'HAR-212',
    title: 'Duplicate credit on webhook redelivery',
    status: 'In progress',
    hoursAgo: 2,
  }),
  item({
    identifier: 'HAR-231',
    title: 'Show retry attempts on each delivery',
    status: 'Todo',
    hoursAgo: 5,
  }),
  item({ identifier: 'HAR-400', title: 'Payments revamp', status: 'Ongoing', hoursAgo: 30 }),
  item({ identifier: 'HAR-388', title: 'Ledger cleanup', status: 'Ongoing', hoursAgo: 50 }),
];

export const LinkScopeScene = () => {
  const [query, setQuery] = useState('');
  return (
    <main className="flex h-screen items-start justify-center bg-background p-10 text-foreground">
      <Popover role="dialog" ariaLabel="Link work" className="w-[34rem] overflow-hidden p-0">
        <LinkWorkPicker
          query={query}
          onQueryChange={setQuery}
          items={ITEMS}
          lookedUp={[]}
          linkedKeys={new Set()}
          sources={['linear']}
          isLoading={false}
          isLinking={false}
          error={null}
          branch="hl/fix-duplicate-credit"
          onLink={() => undefined}
          onClose={() => undefined}
        />
      </Popover>
    </main>
  );
};
