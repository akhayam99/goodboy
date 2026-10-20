import { agentDisplayName } from '../../../../../../shared/utils/agentDisplayName';
import type { TimelineRunEntry } from '../../../../timeline/buildTimelineGroups';
import {
  sessionEventLabel,
  sessionEventProjectRunLabel,
  type TimelineLabelSegment,
} from '../../../../timeline/sessionEventPresentation';
import type { TimelineStreamEntry } from '../../../../timeline/buildTimelineStream';

type Params = {
  readonly entry: Exclude<TimelineStreamEntry, TimelineRunEntry>;
};

export const timelineEntrySegmentsOf = ({ entry }: Params): ReadonlyArray<TimelineLabelSegment> => {
  if (entry.kind === 'agent') {
    return [
      { kind: 'text', text: agentDisplayName({ name: entry.agent.name, kind: entry.agentKind }) },
    ];
  }
  if (entry.kind === 'plan') {
    return [{ kind: 'text', text: entry.plan.title }];
  }
  if (entry.kind === 'artifact') {
    return [{ kind: 'text', text: entry.artifact.title }];
  }
  if (entry.kind === 'issue') {
    return [
      { kind: 'value', text: entry.task.identifier, variant: 'issue' },
      { kind: 'text', text: `: ${entry.task.title}` },
    ];
  }
  if (entry.kind === 'branch') {
    const { mountName, branch } = entry.worktree;
    const created: ReadonlyArray<TimelineLabelSegment> = [
      { kind: 'text', text: 'Branch ' },
      { kind: 'value', text: branch, variant: 'branch' },
      { kind: 'text', text: ' created' },
    ];
    if (mountName == null) {
      return created;
    }
    return [
      ...created,
      { kind: 'text', text: ' for ' },
      { kind: 'value', text: mountName, variant: 'project' },
    ];
  }
  if (entry.kind === 'event') {
    const { projectRun, historyBatch } = entry;
    if (historyBatch !== undefined) {
      return [{ kind: 'text', text: historyBatch.title }];
    }
    if (projectRun != null) {
      return sessionEventProjectRunLabel({
        mounted: projectRun.mounted,
        detached: projectRun.detached,
      });
    }
    return sessionEventLabel({
      event: entry.event,
      ...(entry.repeatCount === undefined ? {} : { repeatCount: entry.repeatCount }),
    });
  }
  if (entry.kind === 'learning') {
    return [{ kind: 'text', text: 'Explained' }];
  }
  const isOpen = entry.questions.every((question) => question.status === 'open');
  const count = entry.questions.length;
  if (isOpen) {
    const first = entry.questions[0];
    if (count === 1 && first != null) {
      return [{ kind: 'text', text: `Question: ${first.text}` }];
    }
    return [{ kind: 'text', text: `${count} questions` }];
  }
  const isAllDismissed = entry.questions.every((question) => question.status === 'dismissed');
  const isAllAnswered = entry.questions.every((question) => question.status === 'answered');
  const noun = count === 1 ? 'question' : 'questions';
  const verb = isAllDismissed ? 'dismissed' : isAllAnswered ? 'answered' : 'resolved';
  return [{ kind: 'text', text: `${count} ${noun} ${verb}` }];
};
