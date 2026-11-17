import type { ReactNode } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_FORM_KINDS, type StartFormKind } from './startFormKinds';

type Props = {
  readonly kind: StartFormKind;
  readonly hasPresets: boolean;
  readonly isDisabled: boolean;
  readonly onPick: (kind: StartFormKind) => void;
  readonly pick: ReactNode;
  readonly detail: ReactNode;
};

const COPY = START_KIND_COPY.plan;

export const StartPlanRow = ({ kind, hasPresets, isDisabled, onPick, pick, detail }: Props) => (
  <>
    <span className="text-meta text-muted-foreground">{COPY.label}</span>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <SegmentedTabs<StartFormKind>
        ariaLabel={COPY.label}
        size="sm"
        value={kind}
        onChange={onPick}
        options={START_FORM_KINDS.map((value) => {
          const isMissing = value === 'preset' && !hasPresets;
          return {
            value,
            label: COPY[value],
            disabled: isDisabled || isMissing,
            ...(isMissing && { tooltip: START_KIND_COPY.noPresets }),
          };
        })}
      />
      {pick}
    </div>
    {detail == null ? null : <div className="col-start-2 min-w-0">{detail}</div>}
  </>
);
