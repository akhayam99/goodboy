import type { SessionId } from '@goodboy/types';
import { AgentStartBlock } from '../AgentStartBlock';
import { AutoComposer } from '../AutoComposer';

type Props = {
  readonly sessionId: SessionId;
  readonly isAuto: boolean;
  readonly actionsHost: HTMLElement | null;
  readonly onClose: () => void;
};

const FOOTER_CLASS = 'px-0 py-0';

export const AgentPanel = ({ sessionId, isAuto, actionsHost, onClose }: Props) =>
  isAuto ? (
    <AutoComposer
      sessionId={sessionId}
      actionsHost={actionsHost}
      footerClassName={FOOTER_CLASS}
      onDone={onClose}
    />
  ) : (
    <AgentStartBlock
      sessionId={sessionId}
      isShown
      actionsHost={actionsHost}
      footerClassName={FOOTER_CLASS}
      onDone={onClose}
    />
  );
