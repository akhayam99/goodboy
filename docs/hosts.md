# Hosts

> **Read this when** you change what Goodboy does on GitHub, GitLab or Bitbucket, add a fourth host, or wonder where a host fact such as a merge method or a link shape comes from. **Not for** what an agent can ask a host through the bridge (`query-bridge.md`) or how a pull request page looks (`navigation.md`).

Every fact that differs per host lives in one table: `HOST_CAPABILITIES` in `packages/core/src/review-source/hostCapabilities.ts`. One row per host. The adapters (`githubReviewSource`, `gitlabReviewSource`, `bitbucketReviewSource` and their pull request ports) read the row. They do not carry their own copy of a merge method list, a url segment, a label or a noun.

## What a row holds

| Field                  | Meaning                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `label`, `nouns`       | How the app names the host and its request: "pull request" or "merge request", `#` or `!`      |
| `mergeMethods`         | Every merge method the host can ever offer, in default order                                   |
| `fallbackMergeMethods` | What the app offers when it cannot read the host's own merge settings                          |
| `requestSegment`       | The path piece of a request url that comes before its number                                   |
| `commitSegment`        | The path piece that comes before a commit sha in a commit link                                 |
| `identity`             | Where "who am I" comes from: the `gh` login, an access token, or an email with a token         |
| `canReconcileByBranch` | The host can find the request opened from a source branch, so a lost link can be rebuilt       |
| `draft`                | `native`, `title-prefix` (the host marks a draft in the title) or `none`                       |
| `canResolveThreads`    | A review thread can be marked resolved                                                         |
| `canReopen`            | A closed request can be reopened                                                               |
| `bridgeProvider`       | The provider name in the query bridge catalog                                                  |
| `bridgeVerbs`          | The bridge verbs for merge, find by branch, reply, resolve, ready and create, `null` if absent |

`REVIEW_SOURCE_CAPABILITIES` (the flags the UI reads) is declared next to it in `types.ts`. A test keeps the two in step, so a flag cannot say a host can resolve a thread while its row says it cannot.

## Where each field comes from

| Field                         | GitHub                                                                                                                                          | GitLab                                                                                                                                                                                                                  | Bitbucket                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge methods                 | [Merge a pull request](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request): `merge_method` is `merge`, `squash` or `rebase`       | [Merge a merge request](https://docs.gitlab.com/api/merge_requests/#merge-a-merge-request) takes `squash`; the project's `merge_method` and `squash_option` come from [Projects](https://docs.gitlab.com/api/projects/) | [Pull requests, merge](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/): `merge_strategy` is `merge_commit`, `squash` or `rebase_merge` |
| Which methods the repo allows | [Repository](https://docs.github.com/en/graphql/reference/objects#repository): `squashMergeAllowed`, `mergeCommitAllowed`, `rebaseMergeAllowed` | [Projects](https://docs.gitlab.com/api/projects/): `merge_method` (`merge`, `rebase_merge`, `ff`) and `squash_option`                                                                                                   | Not read: all three are offered                                                                                                                                      |
| Request url shape             | `html_url` in [Get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request): `/pull/<n>`                                 | `web_url` in [Merge requests](https://docs.gitlab.com/api/merge_requests/): `/-/merge_requests/<iid>`                                                                                                                   | `links.html` in [Pull requests](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/): `/pull-requests/<id>`                                 |
| Commit link shape             | `html_url` in [Get a commit](https://docs.github.com/en/rest/commits/commits#get-a-commit): `/commit/<sha>`                                     | `web_url` in [Commits](https://docs.gitlab.com/api/commits/): `/-/commit/<sha>`                                                                                                                                         | `links.html` in [Commits](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/): `/commits/<sha>`                                                 |
| Identity                      | [Get the authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user), read through `gh api user`                | [Users](https://docs.gitlab.com/api/users/), `GET /user` with the access token                                                                                                                                          | [Users](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-users/), `GET /2.0/user` with the account email and token                                     |
| Find the request by branch    | [List pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests), `head` filter                                             | [List merge requests](https://docs.gitlab.com/api/merge_requests/), `source_branch` filter                                                                                                                              | [Pull requests](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/), query on `source.branch.name`                                         |
| Draft                         | [Mutations](https://docs.github.com/en/graphql/reference/mutations): `markPullRequestReadyForReview`, `convertPullRequestToDraft`               | [Draft merge requests](https://docs.gitlab.com/user/project/merge_requests/drafts/): the title starts with `Draft:`                                                                                                     | No draft call is used                                                                                                                                                |
| Resolve a thread              | [Mutations](https://docs.github.com/en/graphql/reference/mutations): `resolveReviewThread`                                                      | [Discussions](https://docs.gitlab.com/api/discussions/): resolve a merge request thread                                                                                                                                 | No resolve call is used: a comment is a comment                                                                                                                      |
| Reopen                        | [Update a pull request](https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request): `state` back to `open`                              | [Edit a merge request](https://docs.gitlab.com/api/merge_requests/): `state_event` is `reopen`                                                                                                                          | The pull request group has decline and merge, no reopen                                                                                                              |

When a vendor changes one of these pages, change the row and this table in the same commit.

## What keeps the table honest

- The review source contract (`packages/core/src/review-source/__tests__/reviewSourceContract.test.ts`) walks every row. A host with a fake source but no row fails, and so does a row with no fake.
- `hostCapabilities.test.ts` in the same folder checks each row against the capability flags, the labels, the url shapes and the merge method lists.
- The same test reads `apps/desktop/src-tauri/src/query_bridge/protocol.rs` and checks the bridge catalog against the row: every verb the row names must exist with the right access, a denied capability must have no verb, and the merge verb must take the parameter the row names.
- `packages/core/src/hostile-input.test.ts` and `hostile-input.perf.test.ts` run every exported parse, slug, sanitize, normalize and strip helper in `packages/core/src` on a hundred thousand characters of hostile input.

## Adding a host

1. Add the host to `PullRequestHost` in `packages/types`. The row table stops compiling until it has a row.
2. Add its row, then its adapters, reading the row for every fact in the table above.
3. Add its fake to the review source contract. The contract fails until the fake and the row agree.
4. Add its bridge verbs in `protocol.rs` and name them in `bridgeVerbs`. The parity test fails until the catalog and the row agree.
5. Fill its column of the table above with the vendor page each field comes from.
