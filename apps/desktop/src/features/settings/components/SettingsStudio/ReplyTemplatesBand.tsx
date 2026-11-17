import { useContext, useEffect, useRef, useState } from 'react';
import { Disclosure } from '@goodboy/ui';
import { insertReplyPlaceholder } from '../../../resolve/insertReplyPlaceholder';
import {
  replyTemplateProblems,
  type ReplyTemplateVariable,
} from '../../../resolve/renderReplyTemplate';
import {
  REPLY_TEMPLATE_FIXED_DEFAULT,
  REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
} from '../../../resolve/replySettings';
import type { SettingSave } from '../../hooks/useSettingSave';
import { SettingRowFocusContext } from '../../settingRowFocusContext';
import { settingRowKeyOfField } from '../../settingRowKeyOfField';
import { ReplyPlaceholderInsert } from './ReplyPlaceholderInsert';
import { ReplyPreview } from './ReplyPreview';
import { ReplyTemplateField } from './ReplyTemplateField';

export type ReplyTemplateKey = 'replyTemplateFixed' | 'replyTemplateNoChange';

const TEMPLATE_KEYS = [
  'replyTemplateFixed',
  'replyTemplateNoChange',
] as const satisfies ReadonlyArray<ReplyTemplateKey>;

const TEMPLATE_LABEL: Readonly<Record<ReplyTemplateKey, string>> = {
  replyTemplateFixed: 'When fixed',
  replyTemplateNoChange: 'When not changing',
};

const TEMPLATE_DEFAULT: Readonly<Record<ReplyTemplateKey, string>> = {
  replyTemplateFixed: REPLY_TEMPLATE_FIXED_DEFAULT,
  replyTemplateNoChange: REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
};

const ROW_KEY: Readonly<Record<ReplyTemplateKey, string>> = {
  replyTemplateFixed: settingRowKeyOfField({ field: 'replyTemplateFixed' }) ?? 'replyTemplateFixed',
  replyTemplateNoChange:
    settingRowKeyOfField({ field: 'replyTemplateNoChange' }) ?? 'replyTemplateNoChange',
};

type Props = {
  readonly saves: Readonly<Record<ReplyTemplateKey, SettingSave<string>>>;
  readonly noChangePreview: string | null;
};

type DraftParams = {
  readonly key: ReplyTemplateKey;
  readonly next: string;
};

type InsertParams = {
  readonly key: ReplyTemplateKey;
  readonly name: ReplyTemplateVariable;
};

export const ReplyTemplatesBand = ({ saves, noChangePreview }: Props) => {
  const fixed = saves.replyTemplateFixed.value;
  const noChange = saves.replyTemplateNoChange.value;
  const [fixedDraft, setFixedDraft] = useState(fixed);
  const [noChangeDraft, setNoChangeDraft] = useState(noChange);
  const [isOpen, setIsOpen] = useState(false);
  const carets = useRef<Record<ReplyTemplateKey, number | null>>({
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
  });
  const { row } = useContext(SettingRowFocusContext);
  const isSearchTarget = TEMPLATE_KEYS.some((key) => ROW_KEY[key] === row);

  useEffect(() => {
    setFixedDraft(fixed);
  }, [fixed]);

  useEffect(() => {
    setNoChangeDraft(noChange);
  }, [noChange]);

  useEffect(() => {
    if (isSearchTarget) {
      setIsOpen(true);
    }
  }, [isSearchTarget]);

  const drafts: Readonly<Record<ReplyTemplateKey, string>> = {
    replyTemplateFixed: fixedDraft,
    replyTemplateNoChange: noChangeDraft,
  };
  const setters: Readonly<Record<ReplyTemplateKey, (next: string) => void>> = {
    replyTemplateFixed: setFixedDraft,
    replyTemplateNoChange: setNoChangeDraft,
  };
  const isCustom = TEMPLATE_KEYS.some((key) => saves[key].value.trim() !== TEMPLATE_DEFAULT[key]);
  const hasError = TEMPLATE_KEYS.some((key) => saves[key].error !== null);
  const isShown = isOpen || isSearchTarget || hasError;

  const save = ({ key, next }: DraftParams) => {
    if (next === saves[key].value || replyTemplateProblems({ template: next }).length > 0) {
      return;
    }
    void saves[key].save({ value: next });
  };

  const insert = ({ key, name }: InsertParams) => {
    const next = insertReplyPlaceholder({
      text: drafts[key],
      caret: carets.current[key],
      name,
    });
    carets.current[key] = null;
    setters[key](next);
    save({ key, next });
  };

  return (
    <Disclosure
      label={<span className="text-row text-foreground">Reply wording</span>}
      isOpen={isShown}
      onToggle={() => setIsOpen(!isShown)}
      actions={
        <span className="shrink-0 text-meta text-muted-foreground">
          {isCustom ? 'Custom' : 'Default'}
        </span>
      }
    >
      <div className="flex min-w-0 flex-col gap-3 pb-1 pt-2">
        {TEMPLATE_KEYS.map((key) => (
          <ReplyTemplateField
            key={key}
            label={TEMPLATE_LABEL[key]}
            rowKey={ROW_KEY[key]}
            draft={drafts[key]}
            isDisabled={saves[key].isSaving}
            save={saves[key]}
            onDraftChange={(next) => setters[key](next)}
            onCommit={({ caret }) => {
              carets.current[key] = caret;
              save({ key, next: drafts[key] });
            }}
            action={
              <ReplyPlaceholderInsert
                targetLabel={TEMPLATE_LABEL[key]}
                isDisabled={saves[key].isSaving}
                onInsert={(name) => insert({ key, name })}
              />
            }
          >
            {key === 'replyTemplateNoChange' ? (
              <ReplyPreview label="Preview, a comment left as is" text={noChangePreview} />
            ) : null}
          </ReplyTemplateField>
        ))}
      </div>
    </Disclosure>
  );
};
