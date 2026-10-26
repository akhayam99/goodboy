import { Band } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ClassicComposerKeysField } from './ClassicComposerKeysField';
import { useShortcutOverrides } from '../../../../shared/keyboard/overrides/useShortcutOverrides';
import { ShortcutGroupSurface } from './ShortcutGroupSurface';
import { SHORTCUT_COLUMNS } from './shortcutRows';
import { useShortcutRecorder } from './useShortcutRecorder';

export const ShortcutsSection = () => {
  const overrides = useShortcutOverrides();
  const recorder = useShortcutRecorder({ overrides });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-meta text-muted-foreground">
        {`A key does what fits where you are: ${shortcutGlyphs('session.new')} starts a session, but on Chat, Terminal and Ask it starts a chat, a terminal or a reset. ${shortcutGlyphs('palette.open')} goes anywhere. On a list row, right click or Shift+F10 opens the actions of that row.`}
      </p>
      <Band
        inset="content"
        label="Message boxes"
        hint={`A message sends on ${shortcutGlyphs('composer.send')}, a document saves on ${shortcutGlyphs('composer.submit')}.`}
        headingLevel={2}
      >
        <div className="flex flex-col">
          <ClassicComposerKeysField />
        </div>
      </Band>
      {recorder.message === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {recorder.message}
        </p>
      )}
      <div id="keyboard-shortcuts-list" className="grid grid-cols-2 gap-4">
        {SHORTCUT_COLUMNS.map((column) => (
          <div
            key={column.join('-')}
            className="flex min-w-0 flex-col gap-4 [&>section:last-child]:flex-1"
          >
            {column.map((group) => (
              <ShortcutGroupSurface
                key={group}
                group={group}
                overrides={overrides}
                recorder={recorder}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
