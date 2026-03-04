# MCP Automation Hub — STATUS

Updated: 2026-03-04
Owner: Crystal Clear House

## Mission
Run this repo as the **live Automation Hub cockpit** for:
- `crystalclearhouse-data/mcp-automation-hub`
- related repos (Loopkeeper, DiscoAgents, Crystal Clear Voices)

Primary operating mode: plan in chat, execute via repo diffs, validate with tests/plans, then ship.

## Active Workstreams

### 1) Infra Reviews (Cost + Security)
Use Copilot Chat prompt:

> Audit Terraform in this repo for cost/security and propose specific diffs. Prioritize least-privilege IAM, network exposure, state security, backup/retention defaults, and cost hotspots. Return: findings, risk level, and exact file patches.

Baseline checks to request every review:
- remote state + locking configured
- public ingress minimized
- IAM wildcards removed/reduced
- backup/restore posture explicit
- tagging, lifecycle, and cost guardrails present

### 2) Change Generation (MCP Services)
Use Copilot Chat prompt:

> Generate a new Cloud Run Terraform module + GitHub Action to deploy a new MCP service following existing patterns. Include module inputs/outputs, env + secrets wiring, health checks, and rollout/rollback notes.

Definition of done:
- reusable module created
- environment variables + secret manager bindings explicit
- CI workflow builds, deploys, and verifies health
- docs updated with runbook

### 3) n8n Ingestion Pipelines
Use Copilot Chat prompt:

> Given workflow JSON files in `/n8n/workflows` (or local `n8n-workflows/`), build a new ingestion pipeline to Supabase/BigQuery with idempotent writes, dead-letter path, and observability hooks.

Definition of done:
- ingestion path documented (source → normalize → store)
- failure handling and retries defined
- schema mapping + dedupe key defined
- monitoring queries/dashboards stubbed

## Golden Path: Add a New MCP Server
1. Scaffold service code + health endpoint.
2. Add Terraform module and env-specific instantiation.
3. Wire secrets/identity (least privilege).
4. Add GitHub Actions build/deploy workflow.
5. Add telemetry: logs, error budget signal, uptime check.
6. Add runbook + rollback command path.
7. Run security/cost review and apply required diffs.

## Standardization Across DiscoAgents
Canonical patterns to enforce:
- shared IaC modules for service + networking + secrets
- one deploy workflow template with env matrix
- consistent service contracts (`/health`, `/ready`, structured logs)
- standard retry/idempotency strategy for workflow ingestion
- common observability labels/tags (service, env, owner, version)

## Immediate Next Moves
1. Open this file in Copilot Chat and execute the Infra Review prompt.
2. Create `issues/` item from the issue body below (or paste into GitHub issue and pin it).
3. Start module extraction from duplicated Terraform blocks.

---

## Suggested Pinned Issue Body
Title: `MCP Automation Hub: Prompt & Pattern Library`

Body:

```md
This issue is the operating anchor for infrastructure and automation work across:
- mcp-automation-hub
- Loopkeeper
- DiscoAgents
- Crystal Clear Voices

### Prompt Library
- Audit Terraform for cost/security and return exact diffs.
- Generate Cloud Run module + GH Action for new MCP services.
- Build n8n → Supabase/BigQuery ingestion pipelines with retries/idempotency.

### Pattern Library
- Golden path for new MCP server (service → IaC → CI/CD → observability).
- Reusable module strategy for Terraform + workflow templates.
- Standard service contracts and telemetry tags.

### Working Agreement
Every automation change should ship with:
1) explicit diff,
2) validation plan,
3) rollback path,
4) observability hooks.
```
