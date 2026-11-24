import type { ProviderRule } from '@goodboy/core/providers';
import type { WorkspaceId } from '@goodboy/types';
import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { useProviderRule } from '../../../hooks/useProviderRule';
import { SettingRow } from '../../../../settings/settingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const LABEL = 'Provider priority';

const OPTIONS: ReadonlyArray<SegmentedTabOption<ProviderRule>> = [
  { value: 'order', label: 'By order' },
  { value: 'load', label: 'By load' },
];

const RULE_HELP = {
  order:
    'Your provider order wins when several providers fit, but one at 80% of its limit goes after the rest.',
  load: 'The provider in the lowest usage band wins (under 50%, under 80%, under 100%), then the one with fewer recent agents, then your order.',
} as const satisfies Readonly<Record<ProviderRule, string>>;

const WHEN_HELP = 'Applies from the next agent. A run started from a workflow keeps its rule.';

export const ProviderRuleRow = ({ workspaceId }: Props) => {
  const { rule, setRule } = useProviderRule({ workspaceId });
  return (
    <SettingRow label={LABEL} rowKey="provider-priority" help={`${RULE_HELP[rule]} ${WHEN_HELP}`}>
      <SegmentedTabs
        options={OPTIONS}
        value={rule}
        onChange={setRule}
        size="xs"
        ariaLabel={LABEL}
      />
    </SettingRow>
  );
};
