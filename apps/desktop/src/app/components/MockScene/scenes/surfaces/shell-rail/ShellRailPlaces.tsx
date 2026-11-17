import { Eyebrow, ShellRail, ShellRailItem, type ShellRailMark } from '@goodboy/ui';
import { Plus, type IconGlyph } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { navEntryToneOf } from '../../../../../../shared/components/navEntryToneOf';
import { SHELL_RAIL_SCENE_HEIGHT_PX } from './shellRailSceneHeight';

type Place = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconGlyph;
  readonly mark?: ShellRailMark;
};

type Props = {
  readonly form: 'wide' | 'narrow';
  readonly title: string;
  readonly current: string;
  readonly onSelect: (id: string) => void;
};

const PLACES: ReadonlyArray<Place> = [
  {
    id: 'board',
    label: 'Board',
    icon: CONCEPT_ICONS.sessions,
    mark: { kind: 'count', count: 3, name: '3 need you' },
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CONCEPT_ICONS.inbox,
    mark: { kind: 'dot', name: 'new for you' },
  },
  { id: 'workflows', label: 'Workflows', icon: CONCEPT_ICONS.workflows },
  { id: 'chat', label: 'Chat', icon: CONCEPT_ICONS.chat },
  { id: 'connections', label: 'Connect', icon: CONCEPT_ICONS.connections },
  { id: 'impact', label: 'Impact', icon: CONCEPT_ICONS.impact },
];

export const ShellRailPlaces = ({ form, title, current, onSelect }: Props) => (
  <div className="flex flex-col gap-2">
    <Eyebrow label={title} />
    <div
      className="rounded-lg border border-border-soft"
      style={{ height: SHELL_RAIL_SCENE_HEIGHT_PX }}
    >
      <ShellRail label={`Places, ${title}`} form={form}>
        <ShellRailItem
          id="new"
          icon={Plus}
          label="New"
          shortcut="session.new"
          onSelect={() => onSelect('new')}
        />
        {PLACES.map((place) => (
          <ShellRailItem
            key={place.id}
            id={place.id}
            icon={place.icon}
            label={place.label}
            mark={place.mark ?? null}
            tone={navEntryToneOf({ icon: place.icon })}
            isCurrent={current === place.id}
            onSelect={() => onSelect(place.id)}
          />
        ))}
        <span className="min-h-0 flex-1" />
        <ShellRailItem
          id="settings"
          icon={CONCEPT_ICONS.settings}
          label="Settings"
          shortcut="settings.open"
          isCurrent={current === 'settings'}
          onSelect={() => onSelect('settings')}
        />
      </ShellRail>
    </div>
  </div>
);
