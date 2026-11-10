// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { AUTO_PLAN_APPROVE_LABEL } from '../../../../../features/auto/plan/autoPlanApproveLabel';
import { STORY_COMMENT, STORY_PLAN } from '../../scenes/story/storyContent';
import {
  STORY_PLAN_ID,
  STORY_ROOT_ID,
  STORY_SESSION_ID,
  seedStoryWorld,
} from '../../scenes/story/storyWorld';
import { applyStoryAnswer } from '../director/applyStoryAnswer';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { installStoryPlan } from '../director/installStoryPlan';
import { GUIDE_HINTS } from './guideHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
  seedStoryWorld({ stage: 'asking' });
  applyStoryAnswer();
  installStoryPlan({ store });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const PLAN_ROW = '<button type="button" data-testid="plan-row-open">Plan</button>';
const OTHER = '<button type="button" id="other">Other</button>';
const DRAWER = `
  <div data-testid="plan-prose-comments">
    <p>${STORY_PLAN.replayParagraph} A replay test.</p>
  </div>
  <button type="button" aria-label="Comment on this text">Comment</button>
`;
const COMPOSER = `
  <div data-testid="plan-comment-composer">
    <button type="button" data-variant="primary">Add comment</button>
  </div>
`;
const SEND = '<button type="button" data-testid="plan-bar-send">Send to planner</button>';
const APPROVE = `
  <div data-testid="auto-plan-toolbar">
    <button type="button" data-variant="primary">${AUTO_PLAN_APPROVE_LABEL}</button>
  </div>
`;

type RunParams = {
  readonly settledIds: ReadonlyArray<string>;
  readonly isGuarding?: boolean;
};

const run = ({ settledIds, isGuarding = true }: RunParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: ({ chapterId }) => (chapterId === 'guide' ? GUIDE_HINTS : []),
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'guide', settledIds, isGuarding });
  const lit = (): string | null => {
    const last = reports.filter((report) => report.type === 'anchor').at(-1);
    return last?.hintId ?? null;
  };
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const blocked = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : []));
  return { engine, lit, tried, blocked };
};

const settle = (): void => {
  vi.advanceTimersByTime(300);
};

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): boolean => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
  return event.defaultPrevented;
};

const planOf = () => (store.getState().sessionPlans[STORY_SESSION_ID] ?? [])[0];

const addDraft = async (): Promise<void> => {
  await store.getState().addArtifactComment({
    sessionId: STORY_SESSION_ID,
    artifactId: STORY_PLAN_ID,
    revision: 1,
    anchor: { kind: 'block', order: 4, text: STORY_PLAN.replayParagraph },
    body: STORY_COMMENT,
  });
};

const sendDraft = async (): Promise<void> => {
  const plan = planOf();
  if (plan === undefined) {
    throw new Error('no plan');
  }
  await store.getState().sendArtifactComments({ sessionId: STORY_SESSION_ID, plan });
  vi.advanceTimersByTime(8000);
};

describe('closing the plan drawer in the middle of chapter 3', () => {
  it('points back at the plan row and lets the visitor open it again', () => {
    document.body.innerHTML = PLAN_ROW + OTHER;
    const { engine, lit, blocked } = run({ settledIds: ['plan-open'] });
    settle();
    expect(lit()).toBe('plan-mark');
    expect(visitorClick({ selector: '[data-testid="plan-row-open"]' })).toBe(false);
    expect(visitorClick({ selector: '#other' })).toBe(true);
    expect(blocked()).toEqual(['plan-mark']);
    engine.dispose();
  });

  it('goes back to the comment control once the drawer is open again', () => {
    document.body.innerHTML = PLAN_ROW;
    const { engine, lit } = run({ settledIds: ['plan-open'] });
    settle();
    document.body.insertAdjacentHTML('beforeend', DRAWER);
    settle();
    expect(lit()).toBe('plan-mark');
    expect(document.querySelector('[data-demo-anchor="plan-replay"]')).not.toBeNull();
    engine.dispose();
  });

  it('points back at the plan row when the composer was closed without a comment', () => {
    document.body.innerHTML = PLAN_ROW;
    const { engine, lit } = run({ settledIds: ['plan-open', 'plan-mark'] });
    settle();
    expect(lit()).toBe('plan-comment');
    expect(visitorClick({ selector: '[data-testid="plan-row-open"]' })).toBe(false);
    engine.dispose();
  });

  it('points back at the plan row while a comment waits to be sent', async () => {
    document.body.innerHTML = PLAN_ROW;
    await addDraft();
    const { engine, lit } = run({ settledIds: ['plan-open', 'plan-mark', 'plan-comment'] });
    settle();
    expect(lit()).toBe('plan-send');
    expect(visitorClick({ selector: '[data-testid="plan-row-open"]' })).toBe(false);
    engine.dispose();
  });

  it('points back at the plan row while the revised plan waits for approval', async () => {
    document.body.innerHTML = PLAN_ROW;
    await addDraft();
    await sendDraft();
    const { engine, lit } = run({
      settledIds: ['plan-open', 'plan-mark', 'plan-comment', 'plan-send'],
    });
    settle();
    expect(lit()).toBe('plan-approve');
    expect(visitorClick({ selector: '[data-testid="plan-row-open"]' })).toBe(false);
    engine.dispose();
  });

  it('does not send the visitor back to the plan row once the plan is approved', async () => {
    document.body.innerHTML = PLAN_ROW;
    await addDraft();
    await sendDraft();
    await store.getState().sendTurn({
      sessionId: STORY_SESSION_ID,
      agentId: STORY_ROOT_ID,
      content: 'Approved plan v2.',
    });
    const { engine, lit } = run({
      settledIds: ['plan-open', 'plan-mark', 'plan-comment', 'plan-send'],
    });
    settle();
    expect(lit()).toBeNull();
    engine.dispose();
  });

  it('does not offer the plan row for sending while the comment is already on its way', async () => {
    document.body.innerHTML = PLAN_ROW;
    await addDraft();
    const plan = planOf();
    if (plan === undefined) {
      throw new Error('no plan');
    }
    await store.getState().sendArtifactComments({ sessionId: STORY_SESSION_ID, plan });
    const { engine, lit } = run({ settledIds: ['plan-open', 'plan-mark', 'plan-comment'] });
    settle();
    expect(lit()).toBeNull();
    engine.dispose();
  });
});

describe('closing the plan drawer with the comment composer open', () => {
  const lastAnchor = (reports: ReadonlyArray<DemoHintReport>) =>
    reports.filter((report) => report.type === 'anchor').at(-1);

  const openDrawer = (): void => {
    store.setState({
      drawer: {
        kind: 'artifact-document',
        sessionId: STORY_SESSION_ID,
        payload: { artifactId: STORY_PLAN_ID, revision: null },
      },
    });
  };

  it('asks to reopen the plan instead of crediting the comment, then credits it on return', async () => {
    document.body.innerHTML = PLAN_ROW + DRAWER + COMPOSER;
    openDrawer();
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => GUIDE_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    engine.setTrack({ chapterId: 'guide', settledIds: ['plan-open', 'plan-mark'] });
    settle();
    expect(lastAnchor(reports)).toMatchObject({ hintId: 'plan-comment', isRecovering: false });
    document.body.innerHTML = PLAN_ROW;
    store.setState({ drawer: null });
    await addDraft();
    settle();
    const tried = () =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    expect(tried()).toEqual([]);
    expect(lastAnchor(reports)).toMatchObject({
      hintId: 'plan-comment',
      isRecovering: true,
      rect: { x: 100, y: 200 },
    });
    document.body.insertAdjacentHTML('beforeend', DRAWER);
    openDrawer();
    settle();
    expect(tried()).toEqual(['plan-comment']);
    engine.dispose();
  });

  it('names the way back on every step that can lose the drawer', () => {
    const recovering = GUIDE_HINTS.filter((hint) => hint.recovery !== undefined).map(
      (hint) => hint.id,
    );
    expect(recovering).toEqual(['plan-mark', 'plan-comment', 'plan-send', 'plan-approve']);
    for (const hint of GUIDE_HINTS.filter((entry) => entry.recovery !== undefined)) {
      expect(hint.recovery?.copy).toBe('Reopen the plan');
    }
  });
});

describe('chapter 3 steps whose control is gone once they are passed', () => {
  it('credits every step the visitor already passed with the hints hidden', async () => {
    document.body.innerHTML = PLAN_ROW;
    await addDraft();
    await sendDraft();
    const { engine, tried } = run({ settledIds: [], isGuarding: false });
    settle();
    expect(tried()).toEqual(['plan-open', 'plan-mark', 'plan-comment', 'plan-send']);
    engine.dispose();
  });

  it('credits the plan step on the drawer and the comment step on the composer', () => {
    document.body.innerHTML = PLAN_ROW;
    const { engine, tried } = run({ settledIds: [] });
    settle();
    expect(tried()).toEqual([]);
    store.setState({
      drawer: {
        kind: 'artifact-document',
        sessionId: STORY_SESSION_ID,
        payload: { artifactId: STORY_PLAN_ID, revision: null },
      },
    });
    document.body.insertAdjacentHTML('beforeend', DRAWER);
    settle();
    expect(tried()).toEqual(['plan-open']);
    document.body.insertAdjacentHTML('beforeend', COMPOSER);
    settle();
    expect(tried()).toEqual(['plan-open', 'plan-mark']);
    engine.dispose();
  });

  it('lights send, then approve, on their own controls', async () => {
    document.body.innerHTML = PLAN_ROW + DRAWER + COMPOSER;
    await addDraft();
    document.body.insertAdjacentHTML('beforeend', SEND);
    const { engine, lit } = run({ settledIds: ['plan-open', 'plan-mark', 'plan-comment'] });
    settle();
    expect(lit()).toBe('plan-send');
    await sendDraft();
    document.body.insertAdjacentHTML('beforeend', APPROVE);
    settle();
    expect(lit()).toBe('plan-approve');
    engine.dispose();
  });
});

describe('the step copy', () => {
  it('names the approve button the way the plan drawer does', () => {
    const approve = GUIDE_HINTS.find((hint) => hint.id === 'plan-approve');
    expect(approve?.instruction).toContain(`**${AUTO_PLAN_APPROVE_LABEL}**`);
  });
});
