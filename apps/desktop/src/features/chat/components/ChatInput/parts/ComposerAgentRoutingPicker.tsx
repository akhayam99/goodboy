import type { Agent, Session } from '@goodboy/types';
import { useAgentHeaderRouting } from '../../../../../shared/hooks/useAgentHeaderRouting';
import { ComposerRoutingPickerView, type ComposerRouting } from './ComposerRoutingPickerView';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly routing: ComposerRouting;
};

export const ComposerAgentRoutingPicker = ({ session, agent, routing }: Props) => {
  const header = useAgentHeaderRouting({ session, agent });
  return <ComposerRoutingPickerView routing={routing} header={header} />;
};
