import { DrawerFrame, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { useBrowserPage } from '../hooks/useBrowserPage';
import { LazyBrowserPane } from './LazyBrowserPane';

type Props = {
  readonly onClose: () => void;
};

export const WorkspaceBrowserDock = ({ onClose }: Props) => {
  const page = useBrowserPage({ sessionId: null });
  if (page.selectedId === null) {
    return (
      <DrawerFrame
        title="Browser"
        icon={CONCEPT_ICONS.browser}
        iconClassName="text-faint-foreground"
        onClose={onClose}
      >
        <EmptyState
          tone={CONCEPT_TONE.browser}
          icon={CONCEPT_ICONS.browser}
          title="No browser tabs yet"
          description="Open Browser on a session. Its tabs show here."
        />
      </DrawerFrame>
    );
  }
  return <LazyBrowserPane key={page.selectedId} sessionId={page.selectedId} onClose={onClose} />;
};
