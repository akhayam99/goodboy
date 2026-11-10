import { EmptyState, PAGE_MEASURE, PageColumn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useBrowserPage } from '../../hooks/useBrowserPage';
import { BrowserPageHeader } from './BrowserPageHeader';
import { BrowserPageView } from './BrowserPageView';

type Props = {
  readonly sessionId: SessionId | null;
  readonly tabId: string | null;
};

export const BrowserStudioBody = ({ sessionId, tabId }: Props) => {
  const page = useBrowserPage({ sessionId });
  if (page.selectedId === null) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <BrowserPageHeader />
        <PageColumn width={PAGE_MEASURE.browser}>
          <EmptyState
            size="page"
            tone={CONCEPT_TONE.browser}
            icon={CONCEPT_ICONS.browser}
            title="No browser tabs yet"
            description="Open Browser from the right rail. Its tabs show here, grouped by session."
          />
        </PageColumn>
      </div>
    );
  }
  return (
    <BrowserPageView
      key={page.selectedId}
      sessionId={page.selectedId}
      tabId={page.selectedId === sessionId ? tabId : null}
      groups={page.groups}
    />
  );
};
