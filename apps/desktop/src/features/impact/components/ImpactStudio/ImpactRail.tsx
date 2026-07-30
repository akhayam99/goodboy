import { cn } from '@goodboy/ui';
import { Gauge, GitPullRequest, LayoutDashboard, Timer, type LucideIcon } from 'lucide-react';
import type { ImpactScopeId } from '../../lib';

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
        <button
          key={item.id}
          type="button"
          aria-current={isActive}
          onClick={() => onSelect(item.id)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
            isActive
              ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/30'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <Icon size={15} aria-hidden />
          {item.label}
        </button>
      );
    })}
  </nav>
);
