# Security: Execution Isolation

## The current truth

BootProof does **not** provide general-purpose container isolation for repo execution in this release. The execution model is fail-closed by default and consent-gated for host execution, but there is no sandbox.

This document exists because a trust product must not claim more isolation than it implements.

## What happens when you run `bootproof up`

### Default: `--provider docker` (the default)

- For **source-built Compose applications** (repos with a `docker-compose.yml` where the app service builds from source): BootProof runs `docker compose up` and probes the resulting services. This is the only path with real container isolation today.
- For **every other repo** (plain Node, Python, Rust, Go, monorepos without compose, etc.): BootProof **refuses to execute** with `orchestration_not_supported`. It does not silently fall back to the host. The refusal message tells you to use `--provider local --unsafe-local` if you accept host execution.

### `--provider local --unsafe-local`

Runs install and start commands **directly on your host machine**:

```typescript
spawn(command, { cwd, shell: true, detached: true, env })
```

- No container
- No network restriction
- No read-only filesystem
- No privilege reduction
- `shell: true` means shell metacharacters in the command are interpreted

The `--unsafe-local` flag is the explicit consent gate. By passing it, you acknowledge:

1. The repo's `postinstall` scripts will run on your machine during `npm install` / `pnpm install` / `pip install`.
2. The repo's start command will run on your machine with your user privileges.
3. Any side effects — file writes, network calls, env var reads, process spawning — are your machine's problem.

### Remote repos (`bootproof up https://github.com/...`)

BootProof clones for inspection (read-only file analysis, no execution) but **refuses to execute** without `--provider local --unsafe-local`. Inspection is safe; execution requires consent.

## How to use BootProof safely on untrusted repos

1. **Inspect first:** `bootproof up <repo> --dry-run` — shows the inferred plan without executing anything.
2. **Read the plan:** the install command and start command are displayed. Read them.
3. **If you accept the risk:** `bootproof up <repo> --provider local --unsafe-local --install` — runs on your host.
4. **If you need isolation:** use a VM, a disposable container, or a CI runner. BootProof does not provide this for you in the current release.

## What's on the roadmap

General-purpose Docker isolation for non-Compose repos is planned but not implemented. When it ships, `--provider docker` will run any repo inside a container with:
- read-only repo mount
- no network access during install (or pinned registry)
- restricted capability set
- automatic cleanup

Until then, the honest position is: **BootProof tells you the truth about whether a repo boots, but it does not protect your machine while finding out.**

## Reporting a security issue

If you find a way BootProof claims more isolation than it provides, or a way the fail-closed consent gate can be bypassed, that is a security issue. Open a private issue or email ross.buckley@icloud.com.
