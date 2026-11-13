import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import type { LinksOpen } from '../../shared/lib/linksOpenSetting';
import { openPlaceOf } from './openPlaceOf';
import type { OpenPlace, OpenTarget } from './types';

const SESSION_ID = nextSessionId();

const WEB = { kind: 'web', url: 'https://docs.harborline.dev/tax' } as const satisfies OpenTarget;

const savedCopy = (copy: 'document' | 'wireframe'): OpenTarget => ({
  kind: 'saved-copy',
  copy,
  name: 'Rounding drift',
  workspaceSlug: 'harborline',
  folder: 'rounding-drift',
  file: 'index.html',
});

type Row = {
  readonly name: string;
  readonly target: OpenTarget;
  readonly mode: LinksOpen;
  readonly isOwnClick: boolean;
  readonly hasSession: boolean;
  readonly place: OpenPlace;
};

const BESIDE = 'beside-session';
const OUTSIDE = 'your-browser';

const ROWS: ReadonlyArray<Row> = [
  { name: 'web', target: WEB, mode: 'goodboy', isOwnClick: false, hasSession: true, place: BESIDE },
  { name: 'web', target: WEB, mode: 'goodboy', isOwnClick: true, hasSession: true, place: OUTSIDE },
  {
    name: 'web',
    target: WEB,
    mode: 'browser',
    isOwnClick: false,
    hasSession: true,
    place: OUTSIDE,
  },
  { name: 'web', target: WEB, mode: 'browser', isOwnClick: true, hasSession: true, place: OUTSIDE },
  {
    name: 'web',
    target: WEB,
    mode: 'goodboy',
    isOwnClick: false,
    hasSession: false,
    place: OUTSIDE,
  },
  {
    name: 'web',
    target: WEB,
    mode: 'browser',
    isOwnClick: false,
    hasSession: false,
    place: OUTSIDE,
  },
  ...(['document', 'wireframe'] as const).flatMap((copy): ReadonlyArray<Row> => {
    const target = savedCopy(copy);
    const isFollowing = copy === 'document';
    return [
      {
        name: copy,
        target,
        mode: 'goodboy',
        isOwnClick: false,
        hasSession: true,
        place: isFollowing ? BESIDE : OUTSIDE,
      },
      { name: copy, target, mode: 'goodboy', isOwnClick: true, hasSession: true, place: OUTSIDE },
      { name: copy, target, mode: 'browser', isOwnClick: false, hasSession: true, place: OUTSIDE },
      { name: copy, target, mode: 'browser', isOwnClick: true, hasSession: true, place: OUTSIDE },
      { name: copy, target, mode: 'goodboy', isOwnClick: false, hasSession: false, place: OUTSIDE },
      { name: copy, target, mode: 'browser', isOwnClick: false, hasSession: false, place: OUTSIDE },
    ];
  }),
];

describe('where a target opens', () => {
  it.each(ROWS)(
    'sends a $name with Links $mode, command key $isOwnClick, session $hasSession to $place',
    ({ target, mode, isOwnClick, hasSession, place }) => {
      expect(
        openPlaceOf({ target, mode, isOwnClick, sessionId: hasSession ? SESSION_ID : null }),
      ).toBe(place);
    },
  );
});
