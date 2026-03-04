# Pattern Library

## Golden Path: New MCP Server
1. Service scaffold with `/health` + `/ready`.
2. Container build + pinned runtime base.
3. Terraform module (`service`, `iam`, `network`, `secrets`).
4. Environment instantiation (`dev/staging/prod`).
5. GitHub Actions deploy workflow + smoke checks.
6. Observability baseline (structured logs, error rate, latency).
7. Runbook with rollback and incident owner.

## IaC Patterns
- Prefer reusable modules over copy/paste resources.
- Keep env deltas in vars, not duplicated stacks.
- Enforce tags/labels for owner, service, env, cost-center.
- Avoid wildcard IAM unless justified in code review.

## Automation Patterns
- Idempotent operations by default.
- Retry with capped backoff; dead-letter on terminal failure.
- Emit correlation IDs across systems.
- Store workflow metadata/version with each ingestion batch.

## Observability Patterns
- Required log fields: `service`, `env`, `workflow`, `request_id`, `version`.
- Health checks gate rollout completion.
- Dashboards include success rate, latency, error class, backlog/dead-letter counts.
