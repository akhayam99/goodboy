import { useEffect, type ReactNode } from 'react';
import { MessageSquare } from '@goodboy/ui/icons';
import {
  ActivityMessage,
  ActivityMeta,
  ActivityRow,
  Button,
  cn,
  ICON_SIZE,
  WorkNode,
  type ActivityRowTone,
  type WorkNodeSize,
} from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { ACTIVITY_ROW_KIT_SEED } from './activityRowKitSeed';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
};

type Row = (typeof ACTIVITY_ROW_KIT_SEED.agents)[number];

type Agent = Extract<Row, { readonly kind: 'agent' }>;

type Note = Extract<Row, { readonly kind: 'note' }>;

type AgentParams = {
  readonly row: Agent;
};

type NodeParams = {
  readonly row: Agent;
  readonly size: WorkNodeSize;
};

type NoteParams = {
  readonly row: Note;
  readonly density: 'rail' | 'feed';
};

type PanelParams = {
  readonly caption: string;
  readonly width: string;
  readonly children: ReactNode;
};

const STATE_TONE: Record<ActivityRowTone, string> = {
  quiet: 'text-faint-foreground',
  live: 'text-info',
  attention: 'text-warning',
  failed: 'text-danger',
  pending: 'text-faint-foreground',
};

const nodeOf = ({ row, size }: NodeParams) => (
  <WorkNode look="quiet" size={size} state={row.node} label={row.word} mark={{ kind: 'dot' }} />
);

const glyphOf = ({ row }: AgentParams) => (
  <AgentKindChip kind={row.role} density="glyph" className="self-center" />
);

const stateOf = ({ row }: AgentParams) =>
  row.state === null ? null : <span className={STATE_TONE[row.tone]}>{row.state}</span>;

const messageNode = (
  <WorkNode
    look="quiet"
    size="sm"
    state="marker"
    label="Your message"
    mark={{
      kind: 'glyph',
      glyph: <MessageSquare size={ICON_SIZE.mark} className="text-muted-foreground" />,
    }}
  />
);

const noteRowOf = ({ row, density }: NoteParams) => (
  <ActivityMessage
    key={row.id}
    density={density}
    marker={messageNode}
    alignWith={density === 'rail' ? 'narrow' : null}
    text={row.text}
    byline={row.byline}
    isPending={row.isPending}
    actions={
      row.isPending ? (
        <Button variant="ghost" size="xs" onClick={() => undefined}>
          Remove
        </Button>
      ) : null
    }
  />
);

const panelOf = ({ caption, width, children }: PanelParams) => (
  <section aria-label={caption} className={cn('@container flex flex-col gap-1', width)}>
    <span className="text-meta text-faint-foreground">{caption}</span>
    {children}
  </section>
);

export const ActivityRowKitScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return (
    <div
      data-testid="activity-row-kit"
      className="flex flex-wrap items-start gap-8 bg-background p-6 text-foreground"
    >
      {panelOf({
        caption: 'Agents list',
        width: 'w-[380px]',
        children: ACTIVITY_ROW_KIT_SEED.agents.map((row) =>
          row.kind === 'note' ? (
            noteRowOf({ row, density: 'rail' })
          ) : (
            <ActivityRow
              key={row.id}
              density="rail"
              tone={row.tone}
              marker={nodeOf({ row, size: 'sm' })}
              ordinal={row.ordinal}
              glyph={glyphOf({ row })}
              text={row.task}
              meta={
                <ActivityMeta
                  density="rail"
                  columns={['state', 'time', 'cost']}
                  state={stateOf({ row })}
                  time={row.time === null ? null : <span className="text-info">{row.time}</span>}
                  costUsd={row.costUsd}
                />
              }
            />
          ),
        ),
      })}
      {panelOf({
        caption: 'Activity',
        width: 'w-[720px]',
        children: ACTIVITY_ROW_KIT_SEED.feed.map((row) => (
          <div key={row.id} className={cn('flex min-w-0', row.isEntry ? 'h-10' : 'h-7')}>
            <span className="flex w-14 shrink-0 items-center justify-end text-meta tabular-nums text-faint-foreground">
              {row.at}
            </span>
            <ActivityRow
              density="feed"
              tone={row.tone}
              marker={nodeOf({ row, size: row.isEntry ? 'md' : 'sm' })}
              ordinal={row.ordinal}
              glyph={glyphOf({ row })}
              text={row.task}
              textSize={row.isEntry ? 'body' : 'ui'}
              meta={
                <ActivityMeta
                  density="feed"
                  columns={['state', 'model', 'time']}
                  state={stateOf({ row })}
                  model={row.model}
                  time={row.time}
                />
              }
            />
          </div>
        )),
      })}
      {panelOf({
        caption: 'Workflow run',
        width: 'w-[720px]',
        children: ACTIVITY_ROW_KIT_SEED.steps.map((row) =>
          row.kind === 'note' ? (
            <div key={row.id} className="flex h-9 min-w-0">
              {noteRowOf({ row, density: 'feed' })}
            </div>
          ) : (
            <div key={row.id} className="flex h-8 min-w-0">
              <ActivityRow
                density="feed"
                tone={row.tone}
                marker={nodeOf({ row, size: 'sm' })}
                ordinal={row.ordinal}
                ordinalSlot="wide"
                glyph={glyphOf({ row })}
                text={row.task}
                meta={
                  <ActivityMeta
                    density="feed"
                    columns={['state', 'time']}
                    state={stateOf({ row })}
                    time={row.time}
                  />
                }
              />
            </div>
          ),
        ),
      })}
    </div>
  );
};
