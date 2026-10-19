import { WorkTimeProvider } from '../../../../../features/workTreeModel/WorkTimeProvider';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { CentralDoneBody } from './CentralDoneBody';
import { DONE_SESSION, DONE_SESSION_ID } from './centralDoneSeed';

type Props = {
  readonly initialOpenId: string | null;
};

const COLUMN_WIDTH = 720;

export const CentralDoneColumn = ({ initialOpenId }: Props) => {
  const stored = useAppStore((state) => sessionById(state.sessions, DONE_SESSION_ID));
  const session = stored ?? DONE_SESSION;
  return (
    <div data-central-column style={{ width: COLUMN_WIDTH }} className="max-w-full p-6">
      <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
        <CentralDoneBody session={session} initialOpenId={initialOpenId} />
      </WorkTimeProvider>
    </div>
  );
};
