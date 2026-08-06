import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../features/integrations/components/IntegrationGlyph';
import type { FooterCategory } from './categories';
import { FooterButton } from './FooterButton';
import { IntegrationAddPopover } from './IntegrationAddPopover';

type Props = {
  readonly category: FooterCategory;
  readonly enabled: Record<IntegrationGlyphProvider, boolean>;
  readonly openers: Record<IntegrationGlyphProvider, () => void>;
  readonly activeStudio: string | null;
  readonly isSimpleWorkspace: boolean;
};

export const IntegrationCategoryGroup = ({
  category,
  enabled,
  openers,
  activeStudio,
  isSimpleWorkspace,
}: Props) => {
  const members = category.members.filter(
    (member) => !isSimpleWorkspace || member.availableInSimpleWorkspace,
  );
  const connectedMembers = members.filter((member) => enabled[member.provider]);

  return (
    <div role="group" aria-label={category.groupLabel} className="flex items-center gap-0.5">
      {connectedMembers.map((member) => (
        <FooterButton
          key={member.provider}
          icon={<IntegrationGlyph provider={member.provider} size="xs" useBrandColor />}
          label={integrationLabel({ provider: member.provider })}
          title={member.connectedLabel}
          onClick={openers[member.provider]}
          active={activeStudio === member.provider}
          showLabel={false}
        />
      ))}
      <IntegrationAddPopover
        addLabel={category.addLabel}
        emptyLabel={category.emptyLabel}
        exhaustedLabel={category.exhaustedLabel}
        panelLabel={category.groupLabel}
        members={members}
        enabled={enabled}
        openers={openers}
        isExhausted={connectedMembers.length === members.length}
        showLabel={connectedMembers.length === 0}
        active={members.some(
          (member) => member.provider === activeStudio && !enabled[member.provider],
        )}
      />
    </div>
  );
};
