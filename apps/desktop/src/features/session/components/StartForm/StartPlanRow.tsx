import type { ReactNode } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import type { StartFormKind } from './startFormKinds';

export type StartPlanKind = 'lead' | 'agent';

type Props = {
  readonly kind: StartFormKind;
  readonly isDisabled: boolean;
  readonly onPick: (kind: StartPlanKind) => void;
  readonly pick: ReactNode;
  readonly detail: ReactNode;
  readonly isSectioned?: boolean;
};

const COPY = START_KIND_COPY.plan;

const PLAN_KINDS: ReadonlyArray<StartPlanKind> = ['lead', 'agent'];

export const StartPlanRow = ({
  kind,
  isDisabled,
  onPick,
  pick,
  detail,
  isSectioned = false,
}: Props) => {
  const choices = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <SegmentedTabs<StartPlanKind>
        ariaLabel={COPY.label}
        size="sm"
        value={kind === 'agent' ? 'agent' : 'lead'}
        onChange={onPick}
        options={PLAN_KINDS.map((value) => ({
          value,
          label: COPY[value],
          disabled: isDisabled,
        }))}
      />
      {pick}
    </div>
  );
  if (isSectioned) {
    return (
      <>
        {choices}
        {detail == null ? null : <div className="min-w-0">{detail}</div>}
      </>
    );
  }
  return (
    <>
      <span className="text-meta text-muted-foreground">{COPY.label}</span>
      {choices}
      {detail == null ? null : <div className="col-start-2 min-w-0">{detail}</div>}
    </>
  );
};
