# @leemour/cli-core

The parts every command line tool needs and nobody enjoys writing twice: the two output streams,
a renderer for people and for machines, a closed error model with stable exit codes, the OS
keyring behind a testable seam, and injectable clocks.

Extracted from [`brazecli`](https://github.com/leemour/brazecli), where each piece earned its
shape, and shared with [`max-cli`](https://github.com/leemour/max-cli).

**Status: 0.3.0.** Published on npm, used by `max-cli`. Both extraction steps have landed: the
files that move unchanged, and the ones that needed a parameter threaded through. 75 tests.

## The rule this package exists to keep

**In a machine mode, stdout carries data and nothing else.** No spinner, no `✓`, no warning, no
ANSI. Diagnostics go to stderr, in every mode including the pretty one. That is the contract a
script or an agent depends on, and `captureStreams` exists so a test can prove nothing leaked
across.

```ts
import { captureStreams, createRenderer } from "@leemour/cli-core"

const streams = captureStreams()
createRenderer({ format: "json", color: false, streams }).result({ chats: 2 })

streams.stdout // ['{"chats":2}']
streams.stderr // []
```

## What is in it

| | |
|---|---|
| `streams` | the stdout/stderr split, and the capture used to test it |
| `renderer` · `pretty` | `pretty` / `json` / `jsonl`; tables for lists, labelled lines for objects |
| `errors` · `exit-codes` | 14 closed error codes, one exit number each, so a script can branch on `$?` |
| `keyring` | `KeyringStore` with the system, memory and deliberately-broken implementations |
| `time` | monotonic and wall clocks, and the one sleep that both timeouts and backoff use |
| `logger` | the four-method interface a host adapts Pino to — this package logs nothing itself |
| `paths` | `env-paths` for config, state and cache, each overridable by environment variable |
| `config` | JSON config loading that names the bad field, and an atomic write that locks the directory down |
| `credentials` | environment → keyring → file, warning once and falling through when the keyring refuses |
| `logging` | a Pino adapter writing JSON lines with secrets redacted by field name; a file that cannot be written is reported to `onError`, never thrown |
| `retry` | full-jitter backoff, and the distinction between "no answer came" and "safe to repeat" |
| `/testing` | `captureStreams`, `memoryKeyring`, `brokenKeyring`, `fakeClock` |
| `/commands` | the command registry: `describeProgram`, `annotate`, `flatten` — see below |
| `/completion` | shell completion over the registry: `suggest`, `formatSuggestions` — see below |

**Nothing in the root export is HTTP.** Status classification, `Retry-After` parsing and the fetch
seam live in `@leemour/cli-core/http`, so a CLI that speaks a socket never depends on a stack it
does not call:

```ts
import { providerWaitMs, statusToCode } from "@leemour/cli-core/http"
```

**The command registry is `@leemour/cli-core/commands`** — the whole command tree as data, like
`rails routes`, for an agent to read instead of `--help` and for generated documentation. It walks
the live [Commander](https://github.com/tj/commander.js) tree, so a command built in a loop from a
catalog appears exactly like a handwritten one; `annotate` adds what the tree cannot say. Commander
is a type here, not a runtime dependency — an optional peer, 15 or newer.

```ts
import { annotate, describeProgram } from "@leemour/cli-core/commands"

annotate(program.command("send"), { mutates: true, examples: ["max messages send 42 hi"] })
annotate(generated, { origin: "generated", operationId: "campaigns.list" })

describeProgram(program) // [{ path: ["send"], usage, origin, mutates, options: [...], commands: [...] }]
```

Each option says whether it `takesValue` and, separately, whether it is `mandatory` — not
Commander's `required`, which means "takes a value when given" — plus its choices, default,
environment variable, the options it `conflicts` with and the values it `implies`.

**Shell completion is `@leemour/cli-core/completion`**, built on the registry. `suggest` takes the
words typed so far and answers what may come next: a command, an action, an option, one of its
values, or an argument's values from a source the CLI hands in — a local cache, never the network,
because a shell calls it on every Tab. `formatSuggestions` writes the answer in the protocol of the
shell scripts [`@bomb.sh/tab`](https://github.com/bombshell-dev/tab) generates, so the CLI prints
those scripts with tab and answers `<cli> complete -- <words>` with this; cli-core itself does not
depend on tab.

```ts
import { formatSuggestions, suggest } from "@leemour/cli-core/completion"

const words = argv.slice(argv.indexOf("--") + 1)
streams.data(formatSuggestions(suggest({ commands, globalOptions, words, sources: { arguments: { chat: chatNames } } })))
```

**Two traps worth knowing before you use the credential store.** The OS keyring is global: an entry
is addressed by service and account and knows nothing about which config directory asked for it, so
a throwaway config directory silently overwrites the real secret unless you pass `isolated: true`.
And a secret should never be handed to a logger in the first place — redaction by field name is the
second line of defence, not the first.

**Everything the environment knows is passed in.** No `process.env` reads, no config file paths,
no ambient clock. That is what makes a timeout test finish instantly and a keyring test incapable
of reaching a real keychain.

## Where secrets actually go, per platform

The keyring is real on every desktop and absent on most servers, so the fallback is not an edge
case — it is the normal path in CI and containers. Checked against `@napi-rs/keyring` 2.1.0 on
2026-09-19.

| Platform | Backing store | Needs installing |
|---|---|---|
| macOS | Keychain, via the Security framework | nothing — part of the OS |
| Windows | Credential Manager | nothing — part of the OS |
| Linux desktop (GNOME, KDE) | Secret Service over D-Bus — `gnome-keyring`, `kwallet` | nothing on a normal desktop; the keyring must be **unlocked** |
| Linux headless, container, WSL, CI | usually **nothing** — no session bus, no secrets daemon | falls back to a `0600` file, with one warning on stderr |
| FreeBSD | Secret Service, same as Linux | same |

**No compiler is involved.** The package ships prebuilt binaries for twelve platform triples —
macOS arm64/x64, Windows x64/ia32/arm64, Linux x64 and arm64 in both glibc and musl, armv7,
riscv64, FreeBSD x64 — so there is no Rust toolchain and no node-gyp on any mainstream target.
The Linux binary links only against libc: it speaks D-Bus itself rather than through libsecret,
so *libsecret is not a requirement* — a running Secret Service provider is.

Two consequences worth designing for rather than discovering:

- **`auto` is the right default and `file` must stay available.** `credentialStorage: "file"` skips
  the keyring entirely, which is what a container wants and what a locked keyring makes necessary.
- **A locked Linux keyring can block on a prompt** rather than failing. That is the one case the
  fallback does not rescue, and a CLI that hangs looks broken rather than locked.

## Both runtimes

Node 22+ and Bun, and the Bun half is executed rather than assumed:

```sh
pnpm test        # vitest, Node
pnpm smoke:bun   # the same exports, actually run under Bun
pnpm lint
pnpm typecheck
pnpm build
```

## Releasing

Raise `version` in `package.json` through a pull request, merge it, then on `main`:

```sh
bin/release
```

It refuses a dirty tree, a branch other than `main`, a `main` that is not pushed and a version npm
already has, then starts [`release.yml`](.github/workflows/release.yml) and follows it. The workflow
runs every check, publishes through npm's
[trusted publishing](https://docs.npmjs.com/trusted-publishers/) — no npm token in GitHub, and npm
attaches provenance — and tags `v<version>` only once npm shows the new version.

npm trusts the workflow **by file name**: the package's Trusted Publisher settings on npmjs.com name
`leemour` / `cli-core` / `release.yml`. Rename the file and publishing stops until they are updated.

`bin/release --local` is the fallback: it runs the same checks here and publishes with the npm token
from the keyring (`secret-tool`, service `npm`, account `leemour`) without printing it. The token
must be allowed to write `@leemour/cli-core`, not only `@leemour/max-cli`.

## Licence

MIT.
