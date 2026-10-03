import { Band, KbdPill } from '@goodboy/ui';
import {
  COMPOSER_PREFIX_GROUPS,
  PALETTE_PREFIX_GROUPS,
  prefixesOf,
} from '../../../../quick-actions/grammar';
import {
  formatCombo,
  shortcutRangeGlyphs,
  shortcutGlyphs,
} from '../../../../../shared/keyboard/registry';
import {
  ACTION_VERBS,
  CHOICE_OVERFLOW_LABEL,
  CHOICE_SEGMENT_LIMIT,
} from '../../../../../shared/lib/interactionRules';
import { PrefixRow } from './PrefixRow';
import { shortcutRows } from '../../SettingsStudio/shortcutRows';

const FIELD_KINDS: ReadonlyArray<{
  readonly name: string;
  readonly keys: ReadonlyArray<{ readonly glyph: string; readonly does: string }>;
}> = [
  {
    name: 'Message',
    keys: [
      { glyph: formatCombo('Enter'), does: 'sends' },
      { glyph: formatCombo('shift+Enter'), does: 'new line' },
      { glyph: shortcutGlyphs('composer.submit'), does: 'send now' },
    ],
  },
  {
    name: 'Document',
    keys: [
      { glyph: formatCombo('Enter'), does: 'new line' },
      { glyph: shortcutGlyphs('composer.submit'), does: 'save or send' },
    ],
  },
];

export const ListensExtra = () => (
  <div className="grid grid-cols-2 gap-4">
    <Band inset="content" label="One verb per intent" headingLevel={3}>
      <dl className="flex flex-col gap-2 text-label">
        {ACTION_VERBS.map((entry) => (
          <div key={entry.verb} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <dt className="text-row text-foreground">{entry.verb}</dt>
            <dd className="text-muted-foreground">{entry.meaning}</dd>
          </div>
        ))}
      </dl>
    </Band>

    <Band inset="content" label="Choosing a value" headingLevel={3}>
      <dl className="flex flex-col gap-2 text-label">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="text-muted-foreground">{`Up to ${CHOICE_SEGMENT_LIMIT}, fits the row`}</dt>
          <dd className="text-foreground">Segmented control</dd>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <dt className="text-muted-foreground">{`${CHOICE_SEGMENT_LIMIT + 1} or more, or dynamic`}</dt>
          <dd className="text-foreground">List</dd>
        </div>
      </dl>
      <p className="text-secondary text-faint-foreground">
        {`Never a segmented control with a ${CHOICE_OVERFLOW_LABEL} option.`}
      </p>
    </Band>

    <Band inset="content" label="Two kinds of field" headingLevel={3}>
      <dl className="flex flex-col gap-2 text-label">
        {FIELD_KINDS.map((kind) => (
          <div key={kind.name} className="flex flex-col gap-1">
            <dt className="text-row text-foreground">{kind.name}</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              {kind.keys.map((key) => (
                <span key={key.does} className="flex items-center gap-1.5">
                  <KbdPill>{key.glyph}</KbdPill>
                  {key.does}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-secondary text-faint-foreground">
        A key shown in the app does what it says. Keys that only work in one place say where.
      </p>
    </Band>

    <Band inset="content" label="In the Inbox and Notifications" headingLevel={3}>
      <ul className="flex flex-col gap-2">
        {shortcutRows({ group: 'lists' }).map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-label">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <KbdPill className="shrink-0">
              {shortcutRangeGlyphs({ first: row.first, last: row.last })}
            </KbdPill>
          </li>
        ))}
      </ul>
    </Band>

    <div className="col-span-2">
      <Band inset="content" label="Prefixes" headingLevel={3}>
        <div className="grid grid-cols-2 gap-4">
          <PrefixRow
            title="In the composer"
            prefixes={prefixesOf({ groups: COMPOSER_PREFIX_GROUPS })}
          />
          <PrefixRow
            title={`In ${shortcutGlyphs('palette.open')}`}
            prefixes={prefixesOf({ groups: PALETTE_PREFIX_GROUPS })}
          />
        </div>
      </Band>
    </div>
  </div>
);
