# Connect a provider

> **Read this when** you install, sign in to, sign out of or switch the account
> of a provider, or a provider does not connect.
> **Not for** how Connect works inside ([sign-in-checks.md](sign-in-checks.md))
> or what the provider page shows ([provider-page.md](provider-page.md)).

Every provider has a page in **Connections**: open it with **Go to Connections**
in ⌘K, then pick the provider's tile. Most providers connect the same way:

1. Click **Connect**
2. If the CLI is missing, Goodboy installs it first
3. Sign in in the browser and approve the request
4. Back in Goodboy, the card shows your account

**Disconnect** sits in the page menu and asks you to **Confirm**. It removes the
sign-in from your machine only; your account with the vendor stays as it is.

## Claude

**What you need:** a Claude Pro or Max plan on claude.ai, or an Anthropic API key
under **API keys**.

- The install of `claude` takes 5 to 30 seconds, then your browser opens on
  claude.ai
- If the install asks for your password, click the terminal on the card and type
  it. A global npm install can need `sudo` when nvm does not manage your Node

## Cursor

**What you need:** a Cursor Pro plan on cursor.com, or a Cursor API key.

- Goodboy installs `cursor-agent` into `~/.local/bin` and opens a tab on cursor.com
- You stay signed in until you sign out. If Goodboy does not find `cursor-agent`
  after the install, restart Goodboy so it sees the new `PATH`

## Codex

**What you need:** a ChatGPT Plus, Pro, Business or Edu plan, or an OpenAI API key.

- Codex opens your browser on its own. Sign in with ChatGPT and approve
- **Sign in again** on a connected Codex asks first: Codex signs you out before it
  signs you back in, so cancelling halfway leaves you signed out
- Codex saves your sign-in in `~/.codex/auth.json`, which **Disconnect** deletes.
  `OPENAI_API_KEY` in your shell, or a key under **API keys**, also shows Codex as
  connected

## Gemini

**What you need:** a Google AI Pro plan, or a Gemini API key (the free tier works).
Gemini runs through Antigravity (`agy`), the app that replaces the Gemini CLI.

1. Install `agy` from a terminal:
   `curl -fsSL https://antigravity.google/cli/install.sh | bash`
2. Sign in to the Antigravity app with your Google account
3. In Goodboy, open the Gemini page menu and choose **Check again**

The card has no **Connect** button, because you sign in inside the Antigravity
app. A Gemini API key works instead. **Disconnect** deletes
`~/.gemini/antigravity-cli/`.

## Copilot

**What you need:** a Copilot plan on github.com.

- Copilot opens your browser on its own: sign in with GitHub. On a remote shell it
  prints a device code instead
- Copilot can't say whether you are signed in, so the card shows **Connected** as
  soon as the CLI is installed and names no account. Signed out, the first turn
  fails with the CLI's message: use **Sign in again**
- It bills premium requests, not dollars. A turn shows how many it used ("1
  premium request"), never a price
- A `GH_TOKEN` or `GITHUB_TOKEN` in your shell beats the saved sign-in. Copilot
  refuses classic tokens (`ghp_`), so Goodboy leaves every token that is not
  fine-grained (`github_pat_`) out of a Copilot run
- There is no **Disconnect**, because the CLI has no logout command. Type
  `/logout` inside `copilot`

## OpenCode

**What you need:** nothing. OpenCode comes with some models that need no key;
sign in to your OpenCode account to get more.

After **Connect**, a terminal with a menu appears on the card: pick the provider
and sign in. When the login ends, Goodboy checks your sign-in again.
**Disconnect** asks which account to remove.

## OpenRouter and Moonshot

**What you need:** an API key from [OpenRouter](https://openrouter.ai/docs) or
Moonshot. Both run on top of OpenCode.

1. Install OpenCode (see [OpenCode](#opencode)), then click **Detect** on the card
2. Under **API keys**, click **Add key**, give it a name (for example "work") and
   paste it
3. Click **Save key**. Goodboy tests the key with the provider first. A failed
   save keeps what you typed and says why, with **Retry**

To disconnect, remove the key. Goodboy keeps a key while a workspace uses it.

## API keys per workspace

Claude, Cursor, Codex, Gemini, OpenRouter and Moonshot take API keys as well as
the CLI sign-in. Keys sit in your system keychain, not in Goodboy's database.

- Add as many keys as you want, each with its own name
- Under **Workspace credentials**, pick the key each workspace uses
- A workspace with no key shows **billed to CLI login**, one with a key **billed
  to API key**

## Switching accounts

Each provider uses one account at a time, shown on the card, and that account
pays for every turn.

1. Choose **Disconnect** in the page menu and **Confirm**
2. Click **Connect** and sign in with the other account
3. Choose **Check again** and check the account in the header before you continue

## Troubleshooting

- **Provider not detected**: Goodboy looks for CLIs on your `PATH`. Find the CLI
  (`which claude`, `npm root -g`), add its folder to your shell profile, open a new
  shell and restart Goodboy
- **Can't check**: the CLI did not answer three times in 10 minutes. Goodboy shows
  what it last knew and asks again on the next focus or **Check again**
- **Refused your runs**: three runs in 10 minutes were turned down for
  authentication while the CLI says you are signed in. Auto and the fallbacks leave
  the provider alone. Use **Sign in again**. Picking it yourself still runs, and
  one accepted run closes the breaker
- **Browser sign-in stuck**: after 4 seconds the card offers **Open the sign-in
  page again**. After two minutes, **Open in Terminal.app** (or the terminal from
  Settings, Open with, when it can take a command: iTerm does, Warp and Ghostty do
  not) runs the command in your own terminal, and the hint shows it with **Copy
  command**. Goodboy notices when it finishes
- **How close am I to a limit?** Each provider's chip in the top bar shows a bar
  for its tightest window and its percent past 70%. It turns amber from 80%, red
  and full when used up, and fades when old. Hover for every window, click for the
  providers menu. A provider with no figures sits under `+N`
- **Rate limit reached**: every turn, session summaries too, counts against your
  plan. Wait for the reset (about 5 hours on Claude Max), or let the fallback order
  send the next turn elsewhere
- **Wrong account**: follow [Switching accounts](#switching-accounts)
- **A model needs a newer CLI**: the composer and the picker say so before you
  send, and the provider shows **Update needed**. **Update Claude CLI**, under the
  Account rows, runs the update in the card, after any running turn on that
  provider. A refused turn keeps your message for a retry. A CLI whose version
  Goodboy can't read is never flagged
- **A model your account can't use**: the turn fails with the provider's reason
  instead of ending empty, and Goodboy stops picking that model for this account
  until the provider answers on it again
