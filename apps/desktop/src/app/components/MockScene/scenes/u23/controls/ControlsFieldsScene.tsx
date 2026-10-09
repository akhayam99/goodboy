import { useState } from 'react';
import { Checkbox, Input, Kbd, SearchField, SegmentedTabs, Switch, Textarea } from '@goodboy/ui';
import { SceneFrame } from './SceneFrame';
import { SceneRow } from './SceneRow';

export const ControlsFieldsScene = () => {
  const [query, setQuery] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('webhook');
  const [mode, setMode] = useState('first');
  const [isParallel, setIsParallel] = useState(true);
  const [isAttributed, setIsAttributed] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  return (
    <SceneFrame>
      <SceneRow name="Input sm and md">
        <Input aria-label="Branch name" placeholder="nw/fix-posting-rounding" className="w-60" />
        <Input
          aria-label="Branch name, medium"
          size="md"
          placeholder="nw/fix-posting-rounding"
          className="w-60"
        />
        <Input aria-label="Locked field" disabled value="ledger-core" readOnly className="w-60" />
      </SceneRow>
      <SceneRow name="Search field, empty and filled">
        <SearchField
          ariaLabel="Search scripts"
          placeholder="Filter scripts"
          value=""
          onChange={setQuery}
          hint={<Kbd look="cap">/</Kbd>}
          className="w-60"
        />
        <SearchField
          ariaLabel="Search settings"
          value={settingsQuery}
          onChange={setSettingsQuery}
          className="w-60"
        />
        <SearchField
          ariaLabel="Search the inbox, medium"
          size="md"
          placeholder="Search the inbox"
          value=""
          onChange={setQuery}
          className="w-60"
        />
      </SceneRow>
      <SceneRow name="Textarea">
        <Textarea
          aria-label="Reply note"
          placeholder="Add a note for payments-api"
          className="w-96"
        />
      </SceneRow>
      <SceneRow name="Checkbox">
        <Checkbox label="Include drafts" checked={isChecked} onChange={setIsChecked} />
        <Checkbox label="Only unviewed" checked={false} onChange={() => undefined} />
        <Checkbox label="Locked" checked disabled onChange={() => undefined} />
        <Checkbox ariaLabel="Select row" checked={false} indeterminate onChange={() => undefined} />
      </SceneRow>
      <SceneRow name="Switch names the setting">
        <Switch ariaLabel="Parallel agents" checked={isParallel} onChange={setIsParallel} />
        <span className="text-label text-foreground">Parallel agents</span>
        <Switch ariaLabel="Attribution line" checked={isAttributed} onChange={setIsAttributed} />
        <span className="text-label text-foreground">Attribution line</span>
      </SceneRow>
      <SceneRow name="Segmented xs and sm">
        <SegmentedTabs
          size="xs"
          ariaLabel="Activity view"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'first', label: 'Timeline' },
            { value: 'second', label: 'Log' },
          ]}
        />
        <SegmentedTabs
          size="sm"
          ariaLabel="Branch tab"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'first', label: 'Overview' },
            { value: 'second', label: 'Files' },
            { value: 'third', label: 'Comments' },
          ]}
        />
      </SceneRow>
    </SceneFrame>
  );
};
