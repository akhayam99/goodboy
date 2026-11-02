import { FLOATING_SURFACE, cn } from '@goodboy/ui';
import { CommandsList } from '../../../../../features/palette/components/CommandsMode/CommandsList';
import { RunPageSkeleton } from '../../../../../features/session/components/PresetRun/RunPageSkeleton';

export const U34_T39_SCENES = {
  'u34-t39-run-loading': () => (
    <div className="flex h-screen w-full flex-col bg-background">
      <p className="sr-only">Run page while the workflows load</p>
      <RunPageSkeleton />
    </div>
  ),
  'u34-t39-palette-loading': () => (
    <div className="flex h-screen w-full items-start justify-center bg-background p-12">
      <p className="sr-only">Palette while the session loads</p>
      <div className={cn(FLOATING_SURFACE, 'flex w-full max-w-xl flex-col')}>
        <CommandsList
          listRef={{ current: null }}
          listboxId="u34-t39-commands"
          maxHeight={320}
          sections={[]}
          selectedKey={null}
          query=""
          isLoaded={false}
          gateKey="u34-t39"
          optionId={({ id }) => id}
          onSelect={() => undefined}
          onRun={() => undefined}
        />
      </div>
    </div>
  ),
};
