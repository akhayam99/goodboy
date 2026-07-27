import { Sparkles } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { modelLabel } from '../../../features/chat/utils/chat-constants';
import { groupModels } from './groupModels';
import { VariantChip } from './VariantChip';

type Props = {
  readonly ids: ReadonlyArray<string>;
  readonly value: string;
  readonly recommendedModel?: string;
  readonly isRecommended: boolean;
  readonly onSelect: (model: string) => void;
};

export const ModelGrid = ({ ids, value, recommendedModel, isRecommended, onSelect }: Props) => (
  <div className="flex flex-col gap-1">
    {recommendedModel != null && (
      <div className="flex flex-wrap gap-1 px-2.5">
        <button
          type="button"
          onClick={() => onSelect('')}
          title={`Recommended (${modelLabel(recommendedModel)})`}
          aria-pressed={isRecommended}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
            isRecommended && 'bg-background font-medium text-foreground shadow-sm',
          )}
        >
          <Sparkles size={10} className="shrink-0 text-primary" aria-hidden />
          Recommended
          <span className="font-mono text-muted-foreground/60">{modelLabel(recommendedModel)}</span>
        </button>
      </div>
    )}
    {groupModels({ ids }).map((group) => {
      const hasSubgroups = group.subgroups.some((subgroup) => subgroup.label != null);
      return (
        <div key={group.family} className="flex flex-col gap-0.5">
          <span className="px-2.5 pt-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground/50">
            {group.label}
          </span>
          {!hasSubgroups && (
            <div className="flex flex-wrap gap-1 px-2.5">
              {group.subgroups.flatMap((subgroup) =>
                subgroup.ids.map((id) => (
                  <VariantChip
                    key={id}
                    id={id}
                    active={!isRecommended && value === id}
                    onSelect={() => onSelect(id)}
                  />
                )),
              )}
            </div>
          )}
          {hasSubgroups &&
            group.subgroups.map((subgroup) => (
              <div key={subgroup.key} className="flex items-center gap-2 px-2.5 py-0.5">
                <span className="flex-1 text-2xs text-muted-foreground/70">
                  {subgroup.label ?? group.label}
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  {subgroup.ids.map((id) => (
                    <VariantChip
                      key={id}
                      id={id}
                      active={!isRecommended && value === id}
                      onSelect={() => onSelect(id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      );
    })}
  </div>
);
