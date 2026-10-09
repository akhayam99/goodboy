import { Button } from '@goodboy/ui';
import type { ScriptGroup } from '../../scripts';
import { scriptPinId } from '../../scriptPinId';
import { ProjectScriptRow } from '../ProjectScriptsFold/ProjectScriptRow';

type Props = {
  readonly projectName: string;
  readonly groups: ReadonlyArray<ScriptGroup>;
  readonly pins: ReadonlyArray<string>;
  readonly onTogglePin: (pinId: string) => void;
  readonly onClose: () => void;
};

export const ScriptPinPicker = ({ projectName, groups, pins, onTogglePin, onClose }: Props) => {
  const listed = groups.filter((group) => group.scripts.length > 0);
  return (
    <section aria-label={`Scripts of ${projectName}`} className="flex flex-col gap-1 px-2 pb-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-meta text-faint-foreground">
          Pin the scripts you use. They show here and in the palette under $.
        </p>
        <Button variant="secondary" size="xs" onClick={onClose}>
          Done
        </Button>
      </div>
      {listed.map((group) => (
        <div key={`${group.source}:${group.relDir}`} className="flex flex-col">
          {listed.length > 1 || group.relDir !== '' ? (
            <span className="font-mono text-meta text-faint-foreground">
              {group.relDir === '' ? group.packageName : group.relDir}
            </span>
          ) : null}
          {group.scripts.map((script) => {
            const pinId = scriptPinId({
              source: group.source,
              relDir: group.relDir,
              name: script.name,
              savedId: null,
            });
            return (
              <ProjectScriptRow
                key={`${group.relDir}:${script.name}`}
                name={script.name}
                command={script.body}
                isPinned={pins.includes(pinId)}
                onTogglePin={() => onTogglePin(pinId)}
              />
            );
          })}
        </div>
      ))}
    </section>
  );
};
