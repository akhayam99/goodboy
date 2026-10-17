import type { SessionId } from '@goodboy/types';
import { ExploreFileMenu } from '../../../actions/ExploreFileMenu';
import type { ExploreFileActionTarget } from '../../../actions/types';
import { ExploreSpawnPopover } from './ExploreSpawnPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly target: ExploreFileActionTarget;
  readonly isMenuShown: boolean;
  readonly isAskOpen: boolean;
  readonly onAskClosed: () => void;
};

export const ExploreRowActions = ({
  sessionId,
  target,
  isMenuShown,
  isAskOpen,
  onAskClosed,
}: Props) => (
  <div data-slot="explore-row-actions" className="flex w-7 shrink-0 items-center justify-end">
    {isAskOpen ? (
      <ExploreSpawnPopover
        sessionId={sessionId}
        name={target.facts.name}
        relPath={target.facts.relPath}
        absolutePath={target.facts.absolutePath}
        onClosed={onAskClosed}
      />
    ) : null}
    {!isAskOpen && isMenuShown ? <ExploreFileMenu target={target} /> : null}
  </div>
);
