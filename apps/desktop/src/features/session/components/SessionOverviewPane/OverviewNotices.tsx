import type { Session } from '@goodboy/types';
import { LapPublishNotice } from './ProjectMountRows/LapPublishNotice';
import { MountNotices } from './MountNotices';
import type { OverviewNoticesView } from './useOverviewNotices';

type Props = {
  readonly session: Session;
  readonly view: OverviewNoticesView;
};

export const OverviewNotices = ({ session, view }: Props) => {
  const sessionId = session.id;

  return (
    <section
      aria-label="Notices"
      data-overview-notices=""
      className="flex min-w-0 flex-col gap-2 empty:hidden"
    >
      {view.isPublishShown && view.lapProject !== null && view.lapStage !== null ? (
        <LapPublishNotice sessionId={sessionId} project={view.lapProject} stage={view.lapStage} />
      ) : null}
      {view.rows.map((row) => (
        <MountNotices
          key={row.mountId}
          sessionId={sessionId}
          row={row}
          status={view.statusOf({ row })}
          foreign={view.foreignOf({ mountId: row.mountId })}
          isMismatchDismissed={view.isDismissed({ row })}
          onDismissMismatch={() => view.dismiss({ row })}
        />
      ))}
    </section>
  );
};
