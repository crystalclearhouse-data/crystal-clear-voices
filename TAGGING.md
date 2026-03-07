# Release Tagging Strategy — Crystal Clear Voices

## Services

| Compose service   | Tag prefix    | ECR repo                               | Port |
|-------------------|---------------|----------------------------------------|------|
| `voice-server`    | `voice/v`     | `crystal-clear-voice-server`           | 3001 |
| `api-server`      | `api/v`       | `crystal-clear-api-server`             | 3000 |
| `webhook-server`  | `webhook/v`   | `crystal-clear-webhook-server`         | 3002 |
| `crew-service`    | `crew/v`      | `crystal-clear-crew-service`           | 8000 |
| `mcp-server`      | `mcp/v`       | `crystal-clear-mcp-server`             | 3003 |
| *(all services)*  | `v` (global)  | all repos                              | —    |

---

## Tag Format

```
<prefix>/v<MAJOR>.<MINOR>.<PATCH>[-<suffix>]
```

| Suffix     | Environment | GitHub Environment gate |
|------------|-------------|-------------------------|
| `-alpha1`  | dev         | `dev`                   |
| `-rc1`     | staging     | `staging`               |
| *(none)*   | production  | `production`            |

---

## Workflows

### 1. Promote a single service through the pipeline

```bash
# Step 1 — dev (alpha)
git tag voice/v1.3.0-alpha1 && git push origin voice/v1.3.0-alpha1

# Step 2 — staging (RC)
git tag voice/v1.3.0-rc1 && git push origin voice/v1.3.0-rc1

# Step 3 — production
git tag voice/v1.3.0 && git push origin voice/v1.3.0
```

Only the `voice-server` container is restarted at each step. Nothing else is touched.

### 2. Global release (all 5 services at once)

```bash
git tag v1.5.0-alpha1 && git push origin v1.5.0-alpha1   # dev
git tag v1.5.0-rc1    && git push origin v1.5.0-rc1      # staging
git tag v1.5.0        && git push origin v1.5.0          # production
```

All services are built in parallel (matrix) and deployed atomically.

### 3. Emergency hotfix (skip dev/staging)

Use `workflow_dispatch` in GitHub Actions UI — select service and environment directly.
No tag required. Use sparingly.

---

## Environment Gates

| Environment  | EC2 Tag Name                    | Required approvers  |
|--------------|---------------------------------|---------------------|
| `dev`        | `crystal-clear-voices-dev`      | none                |
| `staging`    | `crystal-clear-voices-staging`  | none                |
| `production` | `crystal-clear-voices`          | 1 reviewer required |

Configure approvers in **GitHub → Settings → Environments → production**.

---

## GitHub Repository Variables / Secrets

| Name                    | Where         | Purpose                          |
|-------------------------|---------------|----------------------------------|
| `ENABLE_DEPLOY`         | Var           | Set to `true` to activate builds |
| `AWS_ACCOUNT_ID`        | Secret        | ECR registry prefix              |
| `AWS_ACCESS_KEY_ID`     | Secret        | CI IAM user key                  |
| `AWS_SECRET_ACCESS_KEY` | Secret        | CI IAM user secret               |
| `DISCORD_DEPLOY_WEBHOOK`| Secret        | Failure alerts                   |

---

## What CI Does on a Tag Push

```
push tag  →  [test]  →  [prepare]  →  [build: matrix]  →  [deploy]  →  [notify on failure]
               |            |               |                   |
             always    parses tag      only affected       SSM command to
             runs      → services      services built      correct EC2 fleet
                       → environment   in parallel
```

### `prepare` job outputs

| Output        | Example                                  |
|---------------|------------------------------------------|
| `services`    | `["voice-server"]` or `["voice-server","api-server",...]` |
| `environment` | `dev` / `staging` / `production`         |

---

## Rules

1. **Never push a bare `v*` tag without testing on dev + staging first.**
2. **Never manually edit production `.env` on EC2** — update secrets in SSM Parameter Store.
3. **Never force-push a tag** — delete and recreate if you need to re-run.
4. The `production` environment requires manual approval in GitHub UI before deploy runs.
