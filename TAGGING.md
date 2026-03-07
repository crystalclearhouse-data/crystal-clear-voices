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

No long-lived AWS credentials. Authentication uses GitHub OIDC → AWS IAM role
assumption (short-lived STS tokens, automatically rotated every workflow run).

| Name                    | Type    | Purpose                                          |
|-------------------------|---------|--------------------------------------------------|
| `ENABLE_DEPLOY`         | Var     | Set to `true` to activate builds and deploys     |
| `AWS_ACCOUNT_ID`        | Secret  | ECR registry prefix (`<id>.dkr.ecr…`)            |
| `AWS_DEPLOY_ROLE_ARN`   | Secret  | IAM role ARN output by `terraform apply` (OIDC)  |
| `DISCORD_DEPLOY_WEBHOOK`| Secret  | Discord channel for failure alerts               |

**Removed** (no longer needed — delete from GitHub Secrets if they exist):

| ~~`AWS_ACCESS_KEY_ID`~~     | ~~long-lived key — replaced by OIDC~~ |
| ~~`AWS_SECRET_ACCESS_KEY`~~ | ~~long-lived secret — replaced by OIDC~~ |

### One-time OIDC bootstrap

```bash
# 1. Apply terraform to create the OIDC provider + deploy role
terraform apply -var-file=environments/production.tfvars

# 2. Capture the output ARN
terraform output github_actions_deploy_role_arn
# → arn:aws:iam::<account>:role/crystal-clear-voices-github-actions-deploy

# 3. Add to GitHub secrets
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::..."
gh secret set AWS_ACCOUNT_ID      --body "<your-aws-account-id>"

# 4. Delete the old static keys
gh secret delete AWS_ACCESS_KEY_ID
gh secret delete AWS_SECRET_ACCESS_KEY
```

### Local GitHub App JWT (for API calls, not CI)

```bash
# Install deps once
pip install PyJWT cryptography requests

# Generate JWT only
python3 scripts/gen-github-jwt.py --pem ~/.secrets/gh-app.pem --app-id YOUR_APP_ID

# Generate JWT + exchange for 1-hour installation token
python3 scripts/gen-github-jwt.py --pem ~/.secrets/gh-app.pem --app-id YOUR_APP_ID --token
```

---

## What CI Does on a Tag Push

```
push tag  →  [test]  →  [prepare]  →  [build: matrix]  →  [deploy]  →  [notify on failure]
               |            |               |                   |
             always    parses tag      OIDC → ECR push     OIDC → SSM
             runs      → services      only affected       create GitHub
                       → environment   services in         Deployment record
                                       parallel            + health checks
                                                           + update status
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
