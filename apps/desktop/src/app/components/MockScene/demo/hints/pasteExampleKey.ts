import { STORY_EXAMPLE_KEY } from '../../scenes/story/storyTasks';

type Params = {
  readonly root: Document;
};

export const KEY_FIELD = '#linear-api-key';

const TYPE_STEP_MS = 42;
const TYPE_CHUNK = 2;

const typing = new WeakSet<HTMLInputElement>();

export const pasteExampleKey = ({ root }: Params): void => {
  const input = root.querySelector<HTMLInputElement>(KEY_FIELD);
  const view = root.defaultView;
  if (input === null || view === null || typing.has(input)) {
    return;
  }
  const setValue = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')?.set;
  if (setValue === undefined) {
    return;
  }
  input.focus();
  typing.add(input);
  let length = 0;
  const timer = view.setInterval(() => {
    length = Math.min(length + TYPE_CHUNK, STORY_EXAMPLE_KEY.length);
    setValue.call(input, STORY_EXAMPLE_KEY.slice(0, length));
    input.dispatchEvent(new view.Event('input', { bubbles: true }));
    if (length < STORY_EXAMPLE_KEY.length) {
      return;
    }
    view.clearInterval(timer);
    typing.delete(input);
  }, TYPE_STEP_MS);
};
