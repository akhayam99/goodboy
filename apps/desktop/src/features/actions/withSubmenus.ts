import type { ActionDefinition, ActionSubmenu } from './types';

type Params<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly open: ReadonlyArray<string>;
  readonly copy: ReadonlyArray<string>;
};

type TaggedParams<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly ids: ReadonlyArray<string>;
  readonly submenu: ActionSubmenu;
};

const tagged = <F>({
  definitions,
  ids,
  submenu,
}: TaggedParams<F>): ReadonlyArray<ActionDefinition<F>> =>
  ids.flatMap((id) => {
    const definition = definitions.find((candidate) => candidate.id === id);
    return definition === undefined ? [] : [{ ...definition, submenu }];
  });

export const withSubmenus = <F>({
  definitions,
  open,
  copy,
}: Params<F>): ReadonlyArray<ActionDefinition<F>> => {
  const listed = new Set([...open, ...copy]);
  return [
    ...definitions.filter((definition) => !listed.has(definition.id)),
    ...tagged({ definitions, ids: open, submenu: 'open' }),
    ...tagged({ definitions, ids: copy, submenu: 'copy' }),
  ];
};
