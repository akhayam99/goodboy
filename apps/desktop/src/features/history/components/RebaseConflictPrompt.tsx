import type { MountId, SessionId } from '@goodboy/types';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import type { RebaseFileState } from '../rebaseFileStatesOf';
import { RebaseStopFiles, type OpenFileParams } from './RebaseStopFiles';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly files: ReadonlyArray<RebaseFileState>;
  readonly isHintDisabled: boolean;
  readonly onOpenFile: (params: OpenFileParams) => void;
};

const HINT_LABEL = 'Hint for Auto';

export const RebaseConflictPrompt = ({
  sessionId,
  mountId,
  files,
  isHintDisabled,
  onOpenFile,
}: Props) => (
  <div data-rebase-conflict-count={files.length} className="flex min-w-0 flex-col gap-2">
    <RebaseStopFiles label="Files that conflict" files={files} onOpen={onOpenFile} />
    <StartHint
      sessionId={sessionId}
      scope={START_HINT_SCOPES.rebase({ mountId })}
      label={HINT_LABEL}
      placeholder={START_HINT_COPY.rebase}
      isDisabled={isHintDisabled}
    />
  </div>
);
