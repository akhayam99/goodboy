import type { ScriptPreview } from '@goodboy/types';

type Props = {
  readonly scripts: ReadonlyArray<ScriptPreview>;
};

export const ImportScripts = ({ scripts }: Props) => {
  if (scripts.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-muted-foreground">
        Imported scripts arrive disabled. Open one and save it to enable it.
      </p>
      <ul className="flex flex-col gap-1">
        {scripts.map((script) => (
          <li key={script.id} className="flex flex-col gap-0.5 text-meta">
            <span className="text-foreground">{script.name}</span>
            <code className="truncate text-meta text-muted-foreground">{script.head}</code>
          </li>
        ))}
      </ul>
    </div>
  );
};
