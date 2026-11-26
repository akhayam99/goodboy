# Lead projects and mounts

> **Read this when** you change how a Lead attaches a project (the `mount`
> block), the project ask in its dock, or how a child of the tree gets the
> folder it works in. **Not for** how a single agent picks its folders
> ([mounts.md](../mounts.md)) or the Add a project row itself
> ([permissions.md](permissions.md)).

## The mount block

`mount` attaches a workspace project on the branch the user named (`project`,
optional `branch`, `reason`; `parseMountSpec`). It is how "create a worktree on
app-web with branch X" is done: the worktree is the deliverable, so no
implementer runs `git worktree add`.

`applyMountBlock` follows the Add a project row through the `mountProject` port
(`mountAutoProject`, which calls `ensureProjectMounted` with the branch as
written):

| Row                                             | Mount                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| Allow (**Never**)                               | At once                                                                    |
| When the session allows it (**After the plan**) | Only inside the materialization allowance of `mountTaskFolders`, else asks |
| Ask (**Every step**)                            | Always asks                                                                |

The result is a `refusal` row with a `mount` note (`state` `ask` or `done`), so
replay, recovery and one row per turn work as for a refused delegate. An unknown
or ambiguous project falls back to the folder list.

- A done mount has the code `mounted` (`AUTO_MOUNTED_CODE`): it is no refusal,
  adds no strike to the streak or line to the tail or rail, and the delivery lists
  it under DONE BY GOODBOY.
- A project already added on another branch is not claimed as done: code
  `mount_elsewhere`, a row naming its branch and leaving the move to the user, and
  the tail "Not added: that project is already added on another branch".

`mountOnBranchOf` owns that check over every mount the session holds (a forked
mount counts). `mountAutoProject` runs it before and after the call, because
`ensureProjectMounted` can adopt persisted mounts or share an in-flight request
on another branch; the card runs it after its Add too. The project is looked up
in the owning session's workspace only (`knownMountOf`), never a same-named
repository elsewhere.

## The project ask

A `mount_ambiguous` or `mount_missing` refusal is asked instead (`projectAskOf`,
`AutoProjectAsk`). The composer reads "Pick a project, or write to Auto", so a
chat reply answers too.

When the refusal comes from a `mount` block, or from a writer whose `mount` names
a known workspace project not added yet (`refusalMountNote`), the ask is one
inline step: "To do this, mount payments-api", one line on the worktree to be
created, the primary **Mount payments-api** (a failure keeps the card with the
reason), then **Add project**, **Answer without a project** and **Decline**. The
card says the verb "mount"; the `jargon-copy` guard bans only the noun on screen.
The click mounts on the named branch and tells Auto "Mounted payments-api on
ak/feat-new-explore. Go on with my request.". A mount done at once draws one line
(`mountedLineOf`) until Auto's next turn takes the row.

Otherwise "Where should the Implementer work?" lists the session's projects with
their branch. **Add project** filters the workspace's other projects; the primary
follows the choice (**Use payments-api**, **Use both**, **Use 3 projects**)
beside **Answer without a project**, with **Decline** as a quiet verb (the
`projectAsk` registry kind, drawn by `ObjectActionVerb`). The answer is a message
through `sendTurn` ("Use payments-api and ledger-core: start one Implementer per
project."). A project not in the session is mounted first
(`ensureProjectMounted`), and a failure keeps the ask with the reason. The ask
collapses to its answered line until Auto's next turn.

## The mount of a child

`pickAutoMount`:

1. A named mount wins.
2. A reader without one works in the tree's primary mount.
3. A writer without one gets the only usable mount, else `mount_ambiguous` (Auto
   never guesses a write) or `mount_missing`.

Before `mount_missing` while Add a project is not Ask, `pickChildMount` lets a
writer pick folders as a single agent does (`mountTaskFolders`,
[mounts.md](../mounts.md#who-picks-the-folders)): the project its `mount` names,
or with none usable the only repo, a linked task's repo, or repos its task names
exactly. Inside the session's allowance they are mounted and the pick runs again;
past it a mount proposal waits for the user.
