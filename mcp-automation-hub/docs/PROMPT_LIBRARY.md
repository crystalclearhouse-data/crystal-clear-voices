# Prompt Library

## Infra Review
```text
Audit Terraform in this repo for cost/security and propose specific diffs.
Prioritize:
1) IAM least privilege,
2) public network exposure,
3) state backend hardening,
4) backup/retention controls,
5) cost optimization.
Return a ranked finding list + exact patch plan.
```

## New MCP Service (Cloud Run + CI)
```text
Generate a new Cloud Run Terraform module and GitHub Action workflow to deploy a new MCP service following existing patterns.
Include:
- module inputs/outputs
- env/secret wiring
- health checks + smoke test
- rollback strategy
Provide exact file diffs.
```

## n8n Ingestion
```text
Given n8n workflow JSON files, design and scaffold an ingestion pipeline to Supabase/BigQuery.
Require:
- idempotent writes
- retry/dead-letter flow
- schema mapping
- observability metrics/log fields
Return workflow updates + SQL/table contract.
```

## Module Refactor
```text
List core IaC + automation patterns in this repo, identify duplication, and refactor into reusable modules/templates.
Show migration order and low-risk rollout plan.
```
