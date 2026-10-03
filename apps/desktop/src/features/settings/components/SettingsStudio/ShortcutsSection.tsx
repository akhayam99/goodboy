import { Band } from '@goodboy/ui';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { ClassicComposerKeysField } from './ClassicComposerKeysField';
import { ShortcutGroupSurface } from './ShortcutGroupSurface';
import { SHORTCUT_COLUMNS } from './shortcutRows';

export const ShortcutsSection = () => (
  <div className="flex flex-col gap-4">
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
    <div id="keyboard-shortcuts-list" className="grid grid-cols-2 gap-4">
      {SHORTCUT_COLUMNS.map((column) => (
        <div
          key={column.join('-')}
          className="flex min-w-0 flex-col gap-4 [&>section:last-child]:flex-1"
        >
          {column.map((group) => (
            <ShortcutGroupSurface key={group} group={group} />
          ))}
        </div>
      ))}
    </div>
  </div>
);
