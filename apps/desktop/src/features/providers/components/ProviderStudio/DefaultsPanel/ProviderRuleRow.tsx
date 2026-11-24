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
  order: 'Your provider order wins when several providers fit.',
  load: 'The provider with the most room left wins when several fit.',
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
