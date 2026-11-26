import { STORY_EXAMPLE_KEY } from '../../scenes/story/storyTasks';

type Params = {
  readonly root: Document;
};

export const KEY_FIELD = '#linear-api-key';

export const pasteExampleKey = ({ root }: Params): void => {
  const input = root.querySelector<HTMLInputElement>(KEY_FIELD);
  const view = root.defaultView;
  if (input === null || view === null) {
    return;
  }
  const setValue = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')?.set;
  if (setValue === undefined) {
    return;
  }
  input.focus();
  setValue.call(input, STORY_EXAMPLE_KEY);
  input.dispatchEvent(new view.Event('input', { bubbles: true }));
};
