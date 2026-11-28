import { useEffect } from 'react';
import { ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { useAppStore } from '../../../../store';
import { calendarConnectionStateOf } from '../../model/calendarConnectionStateOf';
import { ConnectionTile } from './ConnectionTile';
import { SetupTile } from './SetupTile';

type Props = {
  readonly onOpen: () => void;
};

const NAME = 'Calendar';
const CalendarGlyph = CONCEPT_ICONS.calendar;
const SETUP_LINE = 'Your meetings and call links, read only';

export const CalendarTile = ({ onOpen }: Props) => {
  const sources = useAppStore((state) => state.calendarSources);
  const failedCount = useAppStore((state) => state.calendarDay?.failedSources.length ?? 0);
  const loadCalendarSources = useAppStore((state) => state.loadCalendarSources);

  useEffect(() => {
    void loadCalendarSources();
  }, [loadCalendarSources]);

  const glyph = <CalendarGlyph size={ICON_SIZE.control} aria-hidden className="shrink-0" />;
  const state = calendarConnectionStateOf({ sourceCount: sources.length, failedCount });
  if (state.setupVerb !== null) {
    return (
      <SetupTile
        id="calendar"
        glyph={glyph}
        name={NAME}
        verb={state.setupVerb}
        line={SETUP_LINE}
        onOpen={onOpen}
      />
    );
  }
  return (
    <ConnectionTile id="calendar" glyph={glyph} name={NAME} state={state} onOpen={onOpen}>
      <span className="truncate text-meta text-foreground">
        {joinFacts({ facts: sources.map((source) => source.label) })}
      </span>
      <span className="text-meta text-faint-foreground">Read only</span>
    </ConnectionTile>
  );
};
