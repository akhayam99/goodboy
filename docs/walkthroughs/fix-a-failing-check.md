# Fix a failing check from the board

A check fails on pull request 318 of Harborline, and you want it green without leaving Goodboy.

1. Open the board and click the card whose signal reads a failed check.
2. In the session, press **Analyze** in Next. The Debugger reproduces the failure and proposes one fix, or two or three options with a recommended one.
3. Read **Finding** and **Proposed fix** in the drawer. Open **Add a hint** above **Start fix** if the agent should weigh something first.
4. Press **Start fix**. The row reads **Fixing** while the agent works.
5. Press **Push** in the same drawer. The row reads **Re-running** while the check runs again.

Why it works: the whole loop stays in the session, from the failing check to the push, so nothing is pasted between tools.

See [Review and resolve](../features/review.md) for the other states a check row can show.
