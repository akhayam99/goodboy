const KIT_PILLS =
  'inline status pills are `<<ok>>`, `<<warn>>`, `<<fail>>` and `<<todo>>`, or with your own words as `<<fail: 2 regions down>>`. use them for states in tables and lists, not as decoration.';

export const REPORT_KIT_GUIDE = [
  'report kit: the report renders in the app and prints to an A4 PDF from the same markdown, so shape it with this vocabulary instead of improvising layout.',
  "the user's request comes first. if it asks for a structure, sections, length, audience or language, follow it exactly and use the kit only to dress it. write in the language of the request.",
  'without such a request, use this shape. open with a `<<summary>>` block of two to four sentences that gives the answer, the outcome and what the reader has to do, with no heading before it. right after it you may add a `<<metrics>>` block with the 2 to 4 numbers that matter and a `<<facts>>` block with identifiers such as ticket, branch, scope and status: summary, metrics and facts form the cover of the PDF, above the table of contents. then write 3 to 6 `##` sections titled by their content, never "section 1", with `###` only when a section has distinct parts. close with a `## Evidence` section that cites each source by its name and kind, for example Apply the fix (Implementer) or Round once per batch (Plan) in plain text, falls back to the id only for a source with no name, and puts what was missing or truncated in a `<<note>>`.',
  'blocks: each marker sits alone on its own line and closes with `<</name>>`. callouts are `<<summary>>` for the lead, `<<decision>>` for a decision taken, `<<risk>>` for what can go wrong, `<<question>>` for an open question a person must answer, `<<note>>` for context or a caveat. a callout holds normal markdown, lists included; use one per point and never stack two in a row.',
  '`<<facts>>` takes one `Label: value` per line with an optional ` | hint`, for identifiers and short attributes, never prose. `<<metrics>>` takes one `Label: value | hint` per line, 2 to 4 lines, each value a number or a few words. `<<timeline>>` takes one `when | what` per line, oldest first, for a sequence of events. `<<pagebreak>>` alone on a line starts a new PDF page, only before a long appendix.',
  KIT_PILLS,
  'plain markdown still does the rest: a table to compare 3 or more items on the same attributes, task lists `- [ ]`, `- [x]` and `- [~]` for next steps and acceptance criteria, fenced code only for code and commands, inline code for paths, ids and identifiers.',
  'never write a `#` title since the title already travels in the envelope, never raw html, never emoji as status, never a bold line standing in for a heading, and never nest lists deeper than two levels.',
].join(' ');

export const PLAN_KIT_GUIDE = [
  'plan kit: the plan renders in the app with the same vocabulary as reports, so use it instead of improvising layout.',
  'blocks: each marker sits alone on its own line and closes with `<</name>>`. callouts are `<<decision>>` for a decision taken, `<<risk>>` for what can go wrong, `<<question>>` for an open question a person must answer, `<<note>>` for context or a caveat. a callout holds normal markdown, lists included; use one per point and never stack two in a row.',
  KIT_PILLS,
  'never raw html, never emoji as status, never a bold line standing in for a heading, and never nest lists deeper than two levels.',
].join(' ');
