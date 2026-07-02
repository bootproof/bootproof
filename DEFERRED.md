# Deferred

Items considered during the 0.4.0 close-out but not built, per scope freeze.

- `--health-script <cmd>`: allow a custom health-check command instead of HTTP polling. Would help workers and non-HTTP services.
- `neutral_runner_signed` trust level: bind attestations to a neutral CI runner identity. Requires a runner-side signing infrastructure that does not exist yet.
- `transparency_logged` trust level: append receipts to a public transparency log. Requires a log infrastructure and a gossip protocol.
- SBOM transitive resolution: currently reads only the lockfile. A `--resolve-transitive` flag would walk the full dependency tree.
- SBOM for non-npm ecosystems: Python (requirements.txt / poetry.lock), Go (go.sum), Ruby (Gemfile.lock).
- `bootproof archive` command: export attestations to external archival storage (S3, etc.) for 10-year regulatory retention. GitHub Actions artifacts max out at 2555 days (~7 years).
- in-toto-compatible predicate for the receipt schema: allows composing BootProof receipts with existing SLSA/in-toto tooling.
- Scheduled re-verification: `bootproof health-monitor --interval 5m --duration 1h` for regulatory re-verification requirements.
- Multi-repo audit dashboard: lives in BootProof Cloud per the OSS/Cloud boundary, not this repo.
- AI suggestion registry: shared, anonymized repair suggestions for ecosystem learning. Cloud boundary.
- `bootproof verify` batch mode: verify a directory of attestations in one pass. Convenience, not correctness.
- Commit-signing integration: sign attestations with a Git commit-signing key instead of the local ed25519 key. Would bind attestations to a developer's GPG/SSH identity.
