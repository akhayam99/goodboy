import { Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';

type Props = {
  readonly provider: string | null;
};

export const AgentProviderMark = ({ provider }: Props) => {
  const id = providerIdOf({ value: provider });
  if (id === null) {
    return null;
  }
  return (
    <Tooltip content={PROVIDER_LABEL[id]}>
      <span
        data-testid="agent-header-provider"
        role="img"
        aria-label={PROVIDER_LABEL[id]}
        className="flex shrink-0 items-center"
      >
        <ProviderGlyph id={id} size={ICON_SIZE.row} />
      </span>
    </Tooltip>
  );
};
