import { useState } from 'react';
import { Popover } from '@goodboy/ui';
import { LinkWorkPicker } from '../../../../../../features/session/components/SessionOverviewPane/LinkWorkPicker';
import type { LinkWorkItem } from '../../../../../../features/session/components/SessionOverviewPane/linkWorkRows';
import { sceneClock } from '../../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

type ItemParams = {
  readonly identifier: string;
  readonly title: string;
  readonly status: string;
  readonly at: string;
};

const item = ({ identifier, title, status, at }: ItemParams): LinkWorkItem => ({
  key: `linear:mock-link-${identifier}`,
  status,
  updatedAt: clock.iso({ at }),
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
    identifier: 'HBL-400',
    title: 'Payments revamp',
    status: 'In progress',
    at: '2026-10-10T07:12:00.000Z',
  }),
  item({
    identifier: 'HBL-411',
    title: 'Show the retry count on each delivery',
    status: 'Todo',
    at: '2026-10-10T04:12:00.000Z',
  }),
  item({
    identifier: 'HBL-398',
    title: 'Ledger cleanup',
    status: 'Todo',
    at: '2026-10-09T09:12:00.000Z',
  }),
];

export const LinkworkStarScene = () => {
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
          starredKeys={new Set(['linear:mock-link-HBL-398'])}
          sources={['linear']}
          isLoading={false}
          isLinking={false}
          error={null}
          onLink={() => undefined}
          onStar={() => undefined}
          onClose={() => undefined}
        />
      </Popover>
    </main>
  );
};
