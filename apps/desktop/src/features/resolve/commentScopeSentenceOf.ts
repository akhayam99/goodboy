import type { CommentScope, CommentScopeSign } from './commentScopeOf';

type Params = {
  readonly scope: CommentScope;
};

type ListParams = {
  readonly items: ReadonlyArray<string>;
};

type PartParams = {
  readonly sign: CommentScopeSign;
  readonly places: ReadonlyArray<string>;
};

const MAX_NAMED = 3;

const listOf = ({ items }: ListParams): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;

const partOf = ({ sign, places }: PartParams): string => {
  switch (sign) {
    case 'rethink':
      return 'asks for a rework';
    case 'places':
      return places.length > MAX_NAMED
        ? `names ${places.length} other places`
        : `names ${listOf({ items: places })}`;
    case 'long':
      return 'is long';
    default: {
      const unexpected: never = sign;
      return unexpected;
    }
  }
};

export const commentScopeSentenceOf = ({ scope }: Params): string =>
  `It ${listOf({ items: scope.signs.map((sign) => partOf({ sign, places: scope.places })) })}.`;
