import { SelectableRow } from '@goodboy/ui';
import { Gauge, GitPullRequest, LayoutDashboard, Timer, type LucideIcon } from 'lucide-react';
import type { ImpactScopeId } from '../../lib';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly scope: ImpactScopeId;
  readonly onSelect: (scope: ImpactScopeId) => void;
};

const ITEMS: ReadonlyArray<{
  readonly id: ImpactScopeId;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'shipped', label: 'Shipped', icon: GitPullRequest },
  { id: 'flow', label: 'Flow', icon: Timer },
  { id: 'efficiency', label: 'Efficiency', icon: Gauge },
];

export const ImpactRail = ({ scope, onSelect }: Props) => (
  <nav className="flex flex-col gap-0.5 p-3" aria-label="Impact scopes">
    {ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = item.id === scope;
      return (
        <SelectableRow
          key={item.id}
          selected={isActive}
          ariaCurrent={isActive}
          onClick={() => onSelect(item.id)}
          className="items-center gap-2.5 px-2.5 py-2 text-sm"
        >
          <Icon size={ICON_SIZE.control} aria-hidden />
          {item.label}
        </SelectableRow>
      );
    })}
  </nav>
);
