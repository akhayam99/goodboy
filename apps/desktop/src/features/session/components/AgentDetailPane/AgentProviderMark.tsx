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
    <span
      data-testid="agent-header-provider"
      className="flex shrink-0 items-center gap-1 text-label text-muted-foreground"
    >
      <ProviderGlyph id={id} size={ICON_SIZE.row} />
      {PROVIDER_LABEL[id]}
    </span>
  );
};
