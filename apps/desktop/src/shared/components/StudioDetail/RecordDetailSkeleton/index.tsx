import { Skeleton } from '@goodboy/ui';
import { PaneShell } from '../../PaneShell';
import { RecordHeader } from '../RecordHeader';
import type { IntegrationGlyphProvider } from '../../../../features/integrations/components/IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly identifier: string;
  readonly title: string;
  readonly loadingLabel: string;
};

const PROPERTY_ROWS = 4;

export const RecordDetailSkeleton = ({ provider, identifier, title, loadingLabel }: Props) => (
  <PaneShell
    scroll="body"
    header={
      <RecordHeader
        provider={provider}
        identifier={identifier}
        title={title}
        byline={<Skeleton className="h-4 w-32 rounded-sm" />}
        facts={
          <div role="status" aria-label={loadingLabel} className="flex min-w-0 flex-col gap-1 py-1">
            {Array.from({ length: PROPERTY_ROWS }, (_, index) => (
              <Skeleton key={index} className="h-7 w-full rounded-sm" />
            ))}
          </div>
        }
      />
    }
  >
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="h-3 w-full rounded-sm" />
      <Skeleton className="h-3 w-full rounded-sm" />
      <Skeleton className="h-3 w-3/4 rounded-sm" />
    </div>
  </PaneShell>
);
