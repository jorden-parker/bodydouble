# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

review-queue is a local-only Next.js app for reviewing GitHub pull requests in
an ADHD-friendly way. It turns a PR into a guided reading path of steps, flags
hotspots, tracks progress and notes across pauses, and submits the review
through the `gh` CLI. It needs `gh` to be installed and logged in, and Node >=
22.22.2 because it uses `node:sqlite` and the installed jsdom, vitest and
typescript-language-server engines require that floor. `.env.local` at the repo
root holds local overrides; it is git-ignored and should be `chmod 600`.

## Commands

- `bun run dev`: dev server on http://review-queue.localhost:4477 (it binds to
  127.0.0.1 only, on purpose)
- `bun run test`: all Vitest tests, with coverage
- `bunx vitest run src/lib/plan/reading-path.test.ts`: one file; add
  `-t "<name>"` for a single test
- `bunx vitest run --project node` or `--project dom`: one test environment only
- `bun run typecheck`, `bun run lint`, `bunx fallow`. Fallow reads
  `coverage/coverage-final.json`, so run `bun run test` first.
- `.claude/verify` (also `bun run verify`): runs the full gate (tests, tsc,
  eslint, fallow, next build). It must pass before you finish.

Vitest has two projects. `*.test.ts` runs in node and `*.test.tsx` runs in jsdom
(setup: `src/test/dom-setup.ts`). Shared test helpers live in `src/test/`:
`git-fixture.ts` builds real temporary git repos, `diff-builders.ts`,
`review-fixture.ts`, and `fake-api.ts` for client components.

## Architecture

**Server pipeline** (`src/lib/review/prepare.ts`). `loadReview` fetches PR
metadata through `gh` (`lib/github/gh.ts`). It then makes a bare clone plus a
worktree per head SHA under `~/.cache/review-queue` (`lib/git/checkout.ts`),
links each workspace package into the worktree's `node_modules` so imports by
package name resolve (`lib/git/workspace-links.ts`), parses the diff
(`lib/git/diff-parser.ts`), and builds a tree-sitter `SymbolIndex` over the
worktree (`lib/symbols/`). From these it computes hotspots (`lib/hotspots/`),
classifies files and orders them into reading-path steps (`lib/plan/`), and
highlights code with shiki (`lib/highlight.ts`). The result is a
`PreparedReview`, memoized in a `globalThis` map keyed by PR and head SHA.

**Re-review after a push** (`review_baselines` table,
`lib/review/interdiff.ts`). The client posts `POST .../seen?sha=` once per load,
after the review GET and before the workspace mounts. `markReviewSeen`
(`lib/review/prepare.ts`) reopens finished steps whose files changed, then
`markSeen` stores the previous head as the session's baseline (once, so a second
push does not move it) and clears `finished_at` so the PR shows as in progress
again; the review GET writes no session state. The `catch-up` session action
clears the baseline. On the resume card, `changes-summary` makes one background
call for a short guess of what the new commits changed, when the interdiff is at
most 6 000 characters (`CHANGES_CHAR_BUDGET`, `lib/llm/changes-summary.ts`); the
answer is cached by baseline and head SHA, and a larger interdiff makes no call.
`changes?sha=` returns the interdiff from the baseline (404 when there is none),
`head` returns the current head, and `submit` answers 409 when the PR head no
longer matches the `headSha` being posted. A review with no line comments whose
verdict and summary already have a receipt on that head is not posted again.

**PR conversation and receipts** (`lib/github/conversation.ts`, `gh.ts`,
`components/review/conversation-*`). The `conversation` route reads up to five
pages of review comments (500 in all) and the first 100 reviews through
`conditionalGet` (ETag cache in the store, TTL cache in `services.ts`), and the
GitHub view of the companion's Context tab (`g g`) shows them with threads per
line. A `reply` route (POST `{ commentId, body }`) posts through
`postReplyToReviewComment`, records a `reply_receipts` row, and drops the cached
conversation with `forgetConversation`; reply bodies render through `Markdown`
only and stay out of `ReviewData` and model prompts, like comment bodies.
`submitReview` returns the created review's id and URL, and the `submissions`
table keeps a receipt of each post. "Start over" never clears receipts. Comment
and review bodies are author-written: they render through `Markdown` only, and
they must stay out of `ReviewData` and every model prompt (`src/lib/llm/**`,
`assist-service.ts`).

**API routes** (`src/app/api/pr/[owner]/[repo]/[number]/*`). The base route
loads the review. `definitions`, `references` and `orientation` take `?sha=` and
use `preparedFromRequest` (`lib/review/route-context.ts`), which returns 409 if
that SHA is no longer in memory. `outline` and `reference-counts` take
`?sha=&path=` (`fileLookupRoute` in `lib/review/symbol-query.ts`). They return a
file's symbol tree and the per-declaration reference counts shown above changed
declarations (`lib/review/reference-counts.ts`, which uses the LSP and falls
back to the index). `file` takes `?sha=&path=` for any file in the head worktree
and returns its highlighted lines (`lib/review/file-lines.ts`); the diff's
"Expand N lines" bars, "Show whole file" and the peek's "Whole file" use it.
`session` applies zod-validated `SessionAction`s
(`lib/review/session-actions.ts`). `submit` posts the review through `gh`.
`assist` (POST `?sha=`, `lib/review/assist-service.ts`) streams plain text from
the model about a range of diff lines. The client sends hunk and line indexes,
never code. The server reads the lines from its own diff, and it ends a failed
stream with the `ASSIST_ERROR_MARKER` from `lib/assist-protocol.ts`, after a
`failure` record that names its kind (`unavailable`, `ended-early` or `failed`).
The assist stream runs a tool loop (`lib/llm/tool-loop.ts`) over
`lib/review/code-tools.ts`: `find_definition`, `find_references`, `search_code`
and `read_file`, limited to tracked files of the head worktree, with results
fenced as `<pr_tool_result>`, at most `lookupBudget` rounds of lookups (4 by
default, 12 at most; the round after the budget runs with no tools and emits a
`budget-ended` phase), and no tools when the model has none. The stream carries
`\u0001{json}\u0001` records (`ASSIST_RECORD_MARKER`): `phase` records (queued,
reading, looking-up, writing, budget-ended) and `failure` records, which
`components/review/assist-stream.ts` parses apart from the answer text. A
request may also set `hasMoreDetail` (800 tokens instead of 300) and
`shouldEscalate` (see the Claude Code backend), and the model sees at most the
last four history messages. The server gives the model no precomputed map of
callers: the system prompt (`INVESTIGATE_RULE` in `lib/llm/assist.ts`) tells it
to spend its lookups on the callers and callees that matter most, and to read
the rest of the changed file and related code itself. `read_file` with no range
reads the whole file (400 lines, 16 000 characters).

**Singletons** (`lib/review/services.ts`). The SQLite `SessionStore`
(`lib/session/store.ts`) is stored on `globalThis` so it survives HMR. It
defaults to `~/.local/share/review-queue/review-queue.db`, and `REVIEW_QUEUE_DB`
overrides that. The store holds sessions, done steps, checked hotspots, notes,
jumps, context symbols and a key/value cache.

**Symbol navigation** (`lib/review/navigation.ts`, `lib/lsp/`). Every identifier
in a navigable file is a link (shiki keyword scopes are excluded in
`lib/highlight.ts`). The `definitions` and `references` routes take the
identifier's exact `path`, `line`, `character` and diff `side`, and ask a real
language server through `lib/lsp/client.ts`. Servers are pooled per worktree and
language on `globalThis`, shut down after 10 idle minutes, and warmed when a
review loads. TypeScript/JavaScript use the bundled `typescript-language-server`
with its own `tsserver`. `gopls` and `pyright-langserver` are used when they are
on `PATH`. `rust-analyzer` also needs `REVIEW_QUEUE_LSP_RUST=on`, because a
repo's own `rust-analyzer.toml` or `.cargo/config.toml` can turn build scripts
back on. Deleted lines, missing servers, timeouts and empty answers fall back to
the tree-sitter `SymbolIndex`. Library locations are never read from disk; they
come back as `scope: "external"` with hover text. Configure it with
`REVIEW_QUEUE_LSP=off` and `REVIEW_QUEUE_LSP_TIMEOUT_MS` (default 8000). PR code
is untrusted, so `lib/lsp/servers.ts` turns off everything that could run it:
build scripts, proc macros, toolchain and module downloads, cgo, repo `rustc`
wrappers, tsserver plugins and type acquisition. Keep it that way when you add a
server.

**Context tab** (`components/review/companion-context.tsx`, `context-list.tsx`,
`context-symbols.ts`). Each peek that resolves is recorded as a seen symbol
(`symbol-seen`), and the reader can pin symbols (`symbol-pin`, `m`). These are
stored in the `context_symbols` table along with where they were clicked from,
so reopening a row re-runs the peek. The tab shows the peek or the symbol list
(with its view and kind toggles and the jump-trail buttons), and a toggle for
the other views it also holds: Outline, Files, Map and GitHub. `g c` opens the
symbols, `g o`, `g f`, `g m` and `g g` open the matching view.

**Files view** (the Files toggle of the Context tab,
`components/review/file-browser-pane.tsx`, `file-view.tsx`) lists every tracked
file of the head worktree via the `files` route (`SymbolIndex.listFiles`).
`openLocation` sends a target in the PR to the diff and anything else to the
read-only `FileView` in the centre; `g f` opens it. Text mode uses the `search`
route (`SymbolIndex.search`, fixed-string `git grep`, 200 results).

**LLM orientation** (`lib/llm/orientation.ts`,
`lib/review/orientation-service.ts`). This is optional and calls a local model
server. Results are cached in the store's cache table. On the local backend the
orientation is built in pieces: each step's explanation (the step header's own
cache, keyed by head SHA) is generated first on the background lane, then one
short call writes the orientation from those summaries, the step list and the
hotspots, with no diff (`orientFromSummaries`). The Claude Code backend keeps
the single prompt. `explanation-progress` counts the cached explanations for the
Brief's progress line. Without `REVIEW_QUEUE_LLM_URL`, `lib/llm/model-choice.ts`
probes oMLX on its loopback port (`CLAUDE_LITE_MLX_PORT`, default 8435, the port
`cl serve` uses) and uses it when it answers; otherwise it uses Ollama
(`OLLAMA_HOST`, default localhost:11434). It reads claude-lite's
`config/sizes.json` and the gitignored `config/local-sizes.json` (found through
`CLAUDE_LITE_HOME` or by following `cl` on `PATH`), and picks the largest size
that the server serves and that fits memory by claude-lite's rule: 70% of
unified memory unless `iogpu.wired_limit_mb` is set, and no limit for a remote
server. `REVIEW_QUEUE_LLM_MODEL` names a model by hand. When nothing usable is
served, the config carries the reason, which names the command to run (such as
`cl serve 9b`), and no model is called. The URL stays environment-only.
`REVIEW_QUEUE_LLM_TIMEOUT_MS` and `REVIEW_QUEUE_LLM=off` configure the rest.
Every call streams, and the timeout (default 180 000 ms) bounds the wait for the
model's first byte and the longest silence between chunks, never the whole
answer. A stream that ends without `message_stop` is an error, and every model
call takes the route's abort signal so a reader who leaves frees the queue.
Turns run in two lanes (`lib/llm/lanes.ts`). Interactive turns (Ask and the
summary draft) run ahead of background ones (orientation, step explanations and
change parts), and an interactive turn aborts a running background turn, which
`askModel` sends again once the interactive one has finished. Each turn's usage
events feed the in-memory reading and writing speeds in `lib/llm/speeds.ts`,
which start from defaults until measured. Thinking follows the chosen size's
`thinking` default, unless `REVIEW_QUEUE_LLM_THINKING=on|off` or Settings says
otherwise; when on, it adds 2048 tokens. `GET /api/model` reports the server,
the chosen model or its reason, whether the server answers, each lane's running
and queued turns, and the speeds.

**Claude Code backend** (`lib/llm/claude-code.ts`, `streamTurn` in
`lib/llm/client.ts`). `REVIEW_QUEUE_LLM_BACKEND=claude-code` (or Backend in
Settings) sends every model turn through the logged-in `claude` CLI instead of
Ollama; `REVIEW_QUEUE_CLAUDE_MODEL` (`haiku` by default, or `sonnet`/`opus`)
picks the model and `REVIEW_QUEUE_CLAUDE_BIN` overrides the binary. Each turn
spawns `claude -p --output-format stream-json --include-partial-messages`, and
its `stream_event` lines carry the same raw events the Ollama stream parser
already reads, so timeouts, the lanes (`lib/llm/lanes.ts`) and the
`message_stop` check are shared. To spend few tokens it replaces Claude Code's
system prompt with the app's own, turns off tools, MCP servers, skills, settings
sources and session saving, runs in an empty temp directory so no `CLAUDE.md` is
found, and caps output with `CLAUDE_CODE_MAX_OUTPUT_TOKENS`. Ask makes one call
with no tools and no `INVESTIGATE_RULE`. An assist request with `shouldEscalate`
sends that one question through this path even when the backend is local, using
the Claude model from Settings; nothing goes here by default. Cache keys include
the model, so Claude and local answers never mix. PR code is sent to Anthropic
on this backend. Constants shared with the client-side settings form live in
`lib/llm/backends.ts`, which must stay free of Node imports.

**Settings page** (`app/settings/page.tsx`, `lib/settings/`,
`components/settings/`). It edits the model on/off, backend (local or Claude
Code), model (Auto or one of the served models), Claude model, thinking (follow
the model, on or off) and timeout, saved in the store's `settings` table. The
Pull Requests section holds the "Prepare the next PR while I'm idle" switch (off
by default, `preparation-settings.ts`): when on, the Queue posts `/api/prepare`
after 30 seconds without input (`components/inbox/idle-preparation.tsx`), and
`prepareReview` (`lib/review/preparation.ts`) loads that PR and runs its
orientation on the background lane, one preparation at a time. Any input from
the reader aborts that request. It shows which model Auto picked and why, and
which sizes do not fit memory. Once saved, these replace the matching
environment variables; the URL stays environment-only so PR code cannot be sent
to another endpoint from the UI. The Claude Code backend is the one exception:
choosing it sends PR code to Anthropic through the `claude` CLI. LLM routes get
their config from `currentLlmConfig()` in `lib/review/services.ts`.
`PUT /api/settings` saves and `DELETE /api/settings/cache` empties the cache
table (orientations, step explanations and GitHub ETags). `GET /api/model`
returns the model status as JSON (`currentModelStatus()`). Its `start` names the
command the app can run when the model is down (`startCommand` in
`model-choice.ts`): `ollama serve` when no server answers and oMLX is not
installed, otherwise `cl serve <smallest fitting size>`, and nothing for a
remote server. The Start button in the app bar posts `POST /api/model/start`,
which runs that command detached (`spawnDetached` in `lib/exec.ts`,
`lib/llm/model-start.ts`), so the server outlives the app, with its output in
`model-server.log` in the data directory. The route never takes the command from
the request.

**Security boundary** (`src/proxy.ts`, the Next 16 replacement for middleware).
The app answers only on its own host name, `review-queue.localhost`
(`APP_HOST_NAME` in `lib/access-token.ts`), because a cookie is shared by every
port of a host: one set on `127.0.0.1` would reach any other local dev server.
Reads on `127.0.0.1`, `localhost` and `[::1]` are redirected to that name, and
every other `Host` is rejected. It then requires the `review-queue-token` cookie
on every request. The token lives in a 0600 file
(`~/.local/share/review-queue/access-token-v2`; `REVIEW_QUEUE_TOKEN_FILE`
overrides it), and `src/instrumentation.ts` prints a
`http://review-queue.localhost:4477/?token=…` link at startup. Opening that link
sets the cookie (HttpOnly, SameSite=Strict). Non-GET requests must also be
same-origin and `application/json`, and every response forbids framing. New
mutating routes depend on this, so keep request bodies JSON. Any request the
browser marks `Sec-Fetch-Site: same-site` or `cross-site` is refused for every
method, so another localhost port cannot read or write with the cookie; a
request without that header is judged by the cookie alone (curl).

**Shell-outs** all go through `lib/exec.ts` (`Runner`). A failed command rejects
with `CommandError`, which keeps the bare reason and what the command printed. A
`gh` call is stopped after 120 seconds (`defaultTimeoutMs`); git has no limit,
because a first clone can take minutes. It drops the repository variables git
exports inside hooks (`lib/git-env.ts`), so checkouts never touch an enclosing
repo. Every git command except the network subcommands (`clone`, `fetch`,
`ls-remote`, `pull`, `push`) runs with `GIT_CONFIG_GLOBAL` set to the null
device and `GIT_CONFIG_NOSYSTEM=1` (`commandEnvironment`), so the reviewer's own
git config cannot change the output the parsers read; the network subcommands
keep that config. The network subcommands also answer GitHub's credential
request from the `gh` login (`gh auth git-credential`, set through
`GIT_CONFIG_COUNT`) and run with `GIT_TERMINAL_PROMPT=0`, so a private repo
needs no git setup beyond `gh` and a missing login fails at once. Modules take a
`run` parameter so tests can inject fakes, and `ReviewDeps` injects
`fetchPullRequest` and `store` the same way.

**Client** (`src/components/review/`). `review-loader.tsx` →
`review-workspace.tsx`, which lays out three regions under one top bar
(`workspace-top-bar.tsx`): the path rail (`path-rail.tsx`: Brief, every step in
reading order, Wrap up), the centre (`centre.tsx`: `brief-page.tsx`, a step with
`step-header.tsx` and `step-bar.tsx`, and `wrap-up-page.tsx`) and the companion
(`companion.tsx`: Ask, Notes, Context). The Ask tab (`ask-panel.tsx`) is one
thread per PR: each stored `AssistThread` is one exchange (its target, action
and turns, kept in creation order in the session's `assistThreads`), and
`use-assist.ts` shows them oldest first, each headed by its target chip. A typed
question goes to the latest exchange when it has the same target on the same
commit (`exchangeToContinue` in `assist-thread.ts`), otherwise it starts a new
one; the quick verbs always start one. Every wait for the model renders
`ModelWaitStatus` (`components/common/model-wait-status.tsx`, phases in plain
words), and the model chips read `GET /api/model` through `useModelStatus`, at
most every 15 s and not while the tab is hidden. "Ask Claude instead" opens
`ask-claude-dialog.tsx`, and `shouldEscalate` is sent only after the reader
confirms. `notice-slot.tsx` shows one notice above the centre, and
`command-palette.tsx` (⌘K) jumps anywhere. State lives in `use-*` hooks
(`use-workspace.ts` holds the page, `use-companion.ts` the regions and tabs,
plus navigation, session edits, peek, jumps, shortcuts and return detection),
and `api.ts` is the only place that fetches. Pure logic is kept in non-hook
modules (`hunk-index.ts`, `locate.ts`, `display-hotspots.ts`, `unfinished.ts`,
`shortcut-keys.ts`, `step-order.ts`, `progress.ts`) and tested in node.
`shortcut-keys.ts` is the one table of keys: the help dialog is generated from
it. The chords `g h` (hotspots in the path rail) and `g g` (GitHub view) are
rows of that table, as are the other `g` chords that open a Context view.
`src/components/inbox/` is the home page, the Queue. Every PR is one entry
(`QueueEntry`, built in `inbox-data.ts` from review requests, the repositories
picked in Settings and sessions), and `queue.ts` ranks and places each one
exactly once: Up next, Continue, New commits, Waiting, then the folds Later
(snoozed, `lib/session/snooze.ts`), Bots (the Dependabot and Smartling PRs the
sections above do not already list), Posted and Archived. Ranking is paused, new
commits, started, not started, then checks passing, smaller, older. Each row is
`queue-row.tsx`, and the rows' own buttons carry the keys `j`/`k`, `s`, `e` and
`r` (`queue-keys.ts`, `use-queue-keys.ts`). Drafts are never listed
(`draft:false`). `loadFacts` in `inbox-data.ts` reads size, checks, head SHA,
closed state and age for every PR of every list, the bots included, through
`listPullRequestFacts` (cached 60 s): one aliased GraphQL call per 50 PRs,
because GitHub cuts a request off after about 10 seconds and size and checks are
slow to compute. A group that fails leaves its PRs without facts.
`?repository=owner/name` filters the queue (`repository-filter.tsx`). `?bots=`
(`dependabot`, `smartling`, `both`; the Show menu in `bot-filter.tsx`) replaces
the queue with a flat list of those bots' PRs (`bot-pull-request-list.tsx`), and
`next.config.ts` redirects the old `/dependabot` and `/smartling` pages to it.
`?sort=` (`recommended`, `oldest`, `newest`, `smallest`, `updated`) orders the
PRs inside each section (`queue.ts`; the sort menu is in `sort-menu.tsx`). A
Queue load is two GitHub calls for up to 50 PRs. `loadQueue` in `gh.ts` reads
all four lists (review requests, the repositories' other PRs, Dependabot,
Smartling) in one aliased GraphQL search, cached for 60 s in `services.ts`,
where `reviewRequests` and `openPullRequests` each hand out their list or throw
its error. The lists ask only for fast fields, so keep size, checks and
`reviewDecision` out of that query. `gh` prints the lists GitHub could answer
before it exits 1 (`CommandError.printed`), so one failed list leaves the
others, and a repository GitHub cannot find fails the three repository lists
with a message that names it. `POST /api/inbox/refresh` clears the GitHub cache
for Refresh. Snooze, wake (`wake`, the Wake button in Later) and archive are
session actions (`snooze`, `wake`, `archive`), and the step total a session
shows as "Step N of M" is written when its review is marked seen. A row shows
the model's one-line intent only when its head SHA already has a cached
orientation (`attachIntents`, no model call).

**UI** (`src/components/ui/`) holds shadcn/ui primitives (Radix base); add more
with `bunx shadcn@latest add <name>` and delete exports nothing uses so Fallow
stays clean. Shared app pieces (`HintButton`, `PathLabel`, `AppDialog`,
`EmptyState`, `Celebration`) live in `src/components/common/`. All colours,
sizes and motion are tokens in `src/app/globals.css`, with dark mode following
`prefers-color-scheme`; use those utilities instead of hex or arbitrary values.

Shared domain types are in `src/lib/types.ts`. Use the `@/` import alias for
`src/`.
