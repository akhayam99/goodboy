import { cn } from '@goodboy/ui';
import { Sparkles } from 'lucide-react';
import {
  modelLabel,
  modelTier,
  parseModelId,
  type CostTier,
} from '../../../features/chat/utils/chat-constants';
import { groupModels } from './groupModels';
import { OptionRow } from './OptionRow';

type Props = {
  readonly ids: ReadonlyArray<string>;
  readonly value: string;
  readonly recommendedModel?: string;
  readonly isRecommended: boolean;
  readonly onSelect: (model: string) => void;
};

const TIER_NOTE: Record<CostTier, string> = {
  cheap: 'cheap',
  mid: 'standard',
  expensive: 'premium',
};

const TIER_DOT: Record<CostTier, string> = {
  cheap: 'bg-success',
  mid: 'bg-warning',
  expensive: 'bg-danger',
};

export const ModelOptions = ({ ids, value, recommendedModel, isRecommended, onSelect }: Props) => (
  <div className="flex flex-col">
    {recommendedModel != null && (
      <OptionRow
        label={modelLabel(recommendedModel)}
        active={isRecommended}
        onSelect={() => onSelect('')}
        glyph={<Sparkles size={11} className="shrink-0 text-primary" aria-hidden />}
        tag="recommended"
      />
    )}
    {groupModels({ ids }).map((group) => (
      <div key={group.family} className="flex flex-col">
        <span className="px-2.5 pb-0.5 pt-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/50">
          {group.label}
        </span>
        {group.subgroups.map((subgroup) => (
          <div key={subgroup.key} className="flex flex-col">
            {subgroup.label != null && (
              <span className="px-2.5 py-0.5 text-2xs text-muted-foreground/70">
                {subgroup.label}
              </span>
            )}
            {subgroup.ids.map((id) => {
              const tier = modelTier(id);
              return (
                <OptionRow
                  key={id}
                  label={subgroup.label != null ? parseModelId(id).variantLabel : modelLabel(id)}
                  active={!isRecommended && value === id}
                  onSelect={() => onSelect(id)}
                  glyph={
                    <span
                      className={cn('size-1.5 shrink-0 rounded-full', TIER_DOT[tier])}
                      aria-hidden
                    />
                  }
                  note={TIER_NOTE[tier]}
                  labelClassName="font-mono"
                  indented={subgroup.label != null}
                  title={id}
                />
              );
            })}
          </div>
        ))}
      </div>
    ))}
  </div>
);
