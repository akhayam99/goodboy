import type { KeyboardEvent } from 'react';
import { TriangleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, SegmentedTabs, StatusDot, type SegmentedTabOption } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../../../shared/components/IntegrationGlyph';
import { integrationLabel } from '../../../../../shared/utils/integrationLabel';
import type { InboxProvider } from '../../../../inbox/types';
import { TASK_PICKER_COPY } from './taskPickerCopy';
import type { TaskPickerSource, TaskPickerView } from './taskPickerView';

type Props = {
  readonly view: TaskPickerView;
  readonly loading: Readonly<Record<InboxProvider, boolean>>;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onChange: (source: TaskPickerSource) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
};

type BadgeParams = {
  readonly count: number;
  readonly isLoading: boolean;
  readonly error: string | null;
};

const sourceMark = ({ count, isLoading, error }: BadgeParams) => {
  if (error !== null) {
    return (
      <TriangleAlert
        size={ICON_SIZE.row}
        aria-label={TASK_PICKER_COPY.sourceFailed}
        className="shrink-0 text-warning"
      />
    );
  }
  if (isLoading && count === 0) {
    return <StatusDot tone="neutral" size="sm" pulsing ariaLabel={TASK_PICKER_COPY.loading} />;
  }
  return <span className="text-meta tabular-nums text-faint-foreground">{count}</span>;
};

export const TaskPickerSources = ({ view, loading, errors, onChange, onKeyDown }: Props) => {
  const options: ReadonlyArray<SegmentedTabOption<TaskPickerSource>> = [
    {
      value: 'all',
      label: TASK_PICKER_COPY.all,
      badge: sourceMark({ count: view.counts.all ?? 0, isLoading: false, error: null }),
    },
    ...view.sources.map((provider) => ({
      value: provider,
      label: integrationLabel({ provider }),
      glyph: <IntegrationGlyph provider={provider} size="xs" useBrandColor />,
      badge: sourceMark({
        count: view.counts[provider] ?? 0,
        isLoading: loading[provider],
        error: errors[provider],
      }),
    })),
  ];

  return (
    <div className="flex min-w-0 shrink-0 px-2 pb-2" onKeyDown={onKeyDown}>
      <SegmentedTabs
        size="xs"
        variant="pill"
        ariaLabel={TASK_PICKER_COPY.sources}
        options={options}
        value={view.source}
        onChange={onChange}
      />
    </div>
  );
};
