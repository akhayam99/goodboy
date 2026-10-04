import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { WorkRouting } from '../../startWorkFromChat';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly defaultRouting: WorkRouting;
  readonly value: WorkRouting | null;
  readonly onChange: (update: (current: WorkRouting | null) => WorkRouting | null) => void;
};

const RUNS_ON_LABEL = 'Runs on';

export const RunsOnField = ({ connectedProviders, defaultRouting, value, onChange }: Props) => {
  const active = value ?? defaultRouting;
  const patch = (fields: Partial<WorkRouting>): void =>
    onChange((current) => ({ ...(current ?? defaultRouting), ...fields }));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-muted-foreground">{RUNS_ON_LABEL}</span>
      <RoutingPicker
        ariaLabel={RUNS_ON_LABEL}
        variant="field"
        align="start"
        availability="run"
        connectedProviders={connectedProviders}
        provider={active.provider}
        model={active.model}
        effort={{
          editable: true,
          value: active.effort,
          onChange: (effort: EffortLevel) => patch({ effort }),
        }}
        disabled={false}
        overridden={value !== null}
        resetLabel="Use default"
        onReset={() => onChange(() => null)}
        onProvider={(provider) => {
          if (provider === '') {
            onChange(() => null);
            return;
          }
          patch({ provider });
        }}
        onModel={(model) => patch({ model })}
      />
      <p className="text-meta text-faint-foreground">
        Default model and effort of the new session.
      </p>
    </div>
  );
};
