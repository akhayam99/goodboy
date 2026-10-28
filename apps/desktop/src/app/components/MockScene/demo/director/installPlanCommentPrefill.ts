import { STORY_COMMENT } from '../../scenes/story/storyContent';

const COMPOSER_FIELD = '[data-testid="plan-comment-composer"] textarea';
const PREFILLED = 'demoPrefilled';

export const installPlanCommentPrefill = (): void => {
  const fill = (): void => {
    const field = document.querySelector<HTMLTextAreaElement>(COMPOSER_FIELD);
    if (field === null || field.value !== '' || field.dataset[PREFILLED] === 'true') {
      return;
    }
    field.dataset[PREFILLED] = 'true';
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(field, STORY_COMMENT);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  new MutationObserver(fill).observe(document.body, { childList: true, subtree: true });
};
