import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import type { WorkspaceTurn } from './lib';
import { SessionBudgetContent } from './SessionBudgetContent';

type Props = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly isCurrent: boolean;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly softCapUsd: number | null;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onOpened: () => void;
};

export const SessionPanel = ({
  sessionId,
  goal,
  isCurrent,
  turns,
  softCapUsd,
  onSaveCap,
  onOpened,
}: Props) => {
  return (
    <StudioPanel
      title={goal}
      subtitle={isCurrent ? 'current session' : 'session spend'}
      action={<OpenSessionButton sessionId={sessionId} onOpened={onOpened} variant="secondary" />}
    >
      <SessionBudgetContent turns={turns} softCapUsd={softCapUsd} onSaveCap={onSaveCap} />
    </StudioPanel>
  );
};
