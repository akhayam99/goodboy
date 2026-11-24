import { cn } from '../../cn';
import { EffortMeter } from './EffortMeter';
import type { CappedModel } from './cappedModels';

type Props = {
  readonly models: ReadonlyArray<CappedModel>;
};

export const FactCardModels = ({ models }: Props) =>
  models.map(({ label, model }) => (
    <div key={model.key} data-fact-model={model.key} className="contents">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {model.mark === undefined ? null : (
            <span className="flex shrink-0 items-center">{model.mark}</span>
          )}
          <span
            className={cn(
              'min-w-0 truncate',
              model.isPlanned === true ? 'text-faint-foreground' : 'text-foreground',
            )}
          >
            {model.name}
          </span>
        </span>
        {model.effort === undefined ? null : (
          <span className="flex shrink-0 items-center gap-2 text-faint-foreground">
            <EffortMeter
              effort={model.effort}
              isPlanned={model.isPlanned === true || model.effort.isPlanned === true}
            />
            <span>{model.effort.word}</span>
          </span>
        )}
      </dd>
    </div>
  ));
