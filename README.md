# @cli-heaven/cli-core

The parts every command line tool needs and nobody enjoys writing twice: the two output streams,
a renderer for people and for machines, a closed error model with stable exit codes, the OS
keyring behind a testable seam, and injectable clocks.

Extracted from [`brazecli`](https://github.com/leemour/brazecli), where each piece earned its
shape, and shared with [`max-cli`](https://github.com/CLI-Heaven/max-cli).

**Status: 0.1.0, not published yet.** The first extraction — the files that move unchanged. Config
loading, credential storage, the Pino adapter, retry primitives and the HTTP layer follow.

## The rule this package exists to keep

**In a machine mode, stdout carries data and nothing else.** No spinner, no `✓`, no warning, no
ANSI. Diagnostics go to stderr, in every mode including the pretty one. That is the contract a
script or an agent depends on, and `captureStreams` exists so a test can prove nothing leaked
across.

```ts
import { captureStreams, createRenderer } from "@cli-heaven/cli-core"

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
| `/testing` | `captureStreams`, `memoryKeyring`, `brokenKeyring`, `fakeClock` |

**Nothing here is HTTP.** An HTTP layer — status classification, `Retry-After` parsing, a fetch
seam — will ship as `@cli-heaven/cli-core/http`, so a CLI that speaks a socket never depends on a
stack it does not call.

**Everything the environment knows is passed in.** No `process.env` reads, no config file paths,
no ambient clock. That is what makes a timeout test finish instantly and a keyring test incapable
of reaching a real keychain.

## Both runtimes

Node 22+ and Bun, and the Bun half is executed rather than assumed:

```sh
pnpm test        # vitest, Node
pnpm smoke:bun   # the same exports, actually run under Bun
pnpm lint
pnpm typecheck
pnpm build
```

## Licence

MIT.
