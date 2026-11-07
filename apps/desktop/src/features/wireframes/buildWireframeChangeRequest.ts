export type WireframeChangeScope = 'screen' | 'all';

export type WireframePickedNode = Readonly<{
  nodeId: string;
  label: string;
}>;

type Params = {
  readonly title: string;
  readonly revision: number;
  readonly ask: string;
  readonly scope: WireframeChangeScope;
  readonly screen: Readonly<{ id: string; title: string }> | null;
  readonly picked: ReadonlyArray<WireframePickedNode>;
  readonly sourceText: string;
};

const RULES =
  'return the whole document in one wireframe artifact block, never a patch. keep the id of every node you did not change, give new nodes new ids, and touch only the picked nodes and the scope asked.';

const prettySpec = ({ sourceText }: { readonly sourceText: string }): string => {
  try {
    return JSON.stringify(JSON.parse(sourceText), null, 2);
  } catch {
    return sourceText;
  }
};

export const buildWireframeChangeRequest = ({
  title,
  revision,
  ask,
  scope,
  screen,
  picked,
  sourceText,
}: Params): string => {
  const where =
    scope === 'screen' && screen !== null
      ? `scope: only the screen "${screen.title}" (id ${screen.id}); leave every other screen exactly as it is.`
      : 'scope: any screen of the wireframe.';
  const pins =
    picked.length === 0
      ? 'picked nodes: none.'
      : `picked nodes: ${picked.map((node) => `${node.label} (id ${node.nodeId})`).join(', ')}.`;
  return [
    `change the wireframe "${title}", now at v${revision}, into v${revision + 1}.`,
    `the request: ${ask.trim()}`,
    where,
    pins,
    RULES,
    'the current spec:',
    prettySpec({ sourceText }),
  ].join('\n\n');
};
