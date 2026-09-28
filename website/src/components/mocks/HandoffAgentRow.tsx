import type { ChipKind, HandoffAgentData } from '../../data/harborline';
import { ProviderIcon } from './ProviderIcon';
import { StateChip } from './StateChip';

type Props = {
  readonly agent: HandoffAgentData;
  readonly state: ChipKind;
  readonly isHidden?: boolean;
};

export const HandoffAgentRow = ({ agent, state, isHidden = false }: Props) => (
  <div
    className={isHidden ? 'mk-hrow is-hidden' : 'mk-hrow'}
    aria-hidden={isHidden ? true : undefined}
  >
    <ProviderIcon provider={agent.provider} />
    <span className="mk-role">{agent.role}</span>
    <span className="mk-wm">
      <span className="mk-what mk-ell">{agent.what}</span>
      <span className="mk-model">{agent.model}</span>
    </span>
    <span className="mk-state">
      <StateChip kind={state} />
    </span>
  </div>
);
