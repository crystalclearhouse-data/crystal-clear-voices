# Agent Authority — Crystal Clear Voices

> This file defines what AI agents (Claude Code, Claude, Cursor, Copilot, etc.)
> are permitted to do autonomously vs. what requires explicit user approval.
> All agents working in this repo must respect these boundaries.

---

## Workspace Boundary

- **All file operations are scoped to:** `${workspaceFolder}` (`/Users/data-house/projects/crystalclearhouse-data`)
- Agents **must not** read, write, or delete files outside this directory
- Agents **must not** access other projects on this machine

---

## Permitted Without Approval

| Action | Scope |
|---|---|
| Read any file | Within `${workspaceFolder}` |
| Write / edit source files | Within `${workspaceFolder}` |
| Create new files | Within `${workspaceFolder}` |
| Run `npm install` / `npm run` | `voice-server/`, `api-server/` only |
| Run `git status`, `git log`, `git diff` | This repo only |
| Run `git add` + `git commit` | This repo only |
| Run `docker-compose up/down` | `docker-compose.yml` in project root only |
| Run `bash scripts/dev-up.sh` or `dev-down.sh` | This repo only |
| Read `.env.example` | ✅ |

---

## Requires Explicit User Approval

| Action | Why |
|---|---|
| `git push` to any remote | Affects shared state |
| `git push --force` | Destructive — must confirm target branch and remote |
| Create or delete GitHub branches | Shared state |
| Open or merge a Pull Request | Shared state |
| Delete any file | Irreversible |
| `git reset --hard` or `git checkout .` | Discards uncommitted work |
| Modify `.github/workflows/*.yml` | Affects CI/CD pipeline |
| Modify `terraform/*.tf` | Infrastructure changes |
| Modify `prisma/schema.prisma` + run migrations | Database schema changes |
| Run `prisma migrate deploy` | Applies DB migrations |
| Commit anything matching `*.env*` (except `.env.example`) | Secret exposure risk |
| Send any external HTTP request outside localhost | External side effects |
| Post to social media platforms | Public-facing action |
| Make Twilio calls | Billable action |

---

## Hard Prohibitions (Never Do)

- **Never commit** `.env`, `*.pem`, `*credentials*`, `*secret*`, `*token*` files
- **Never force-push** `main` or `production` branches
- **Never delete** `terraform/` directory
- **Never read or log** the contents of `voice-server/.env`
- **Never run** `rm -rf` without explicit confirmation
- **Never modify** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, or `TWILIO_*` in `.env` files — only in `.env.example` (with placeholder values)
- **Never call** external APIs using production credentials during development tasks

---

## Secret Protection

Files that must **never** be committed (enforced by `.gitignore`):

```
voice-server/.env
api-server/.env
terraform/terraform.tfvars
voice-server/.google-oauth-credentials.json
voice-server/.google-oauth-token.json
**/*.pem
**/*.key
```

If an agent detects a secret in a file about to be committed, it must:
1. Abort the commit
2. Alert the user immediately
3. Suggest adding the file to `.gitignore`

---

## Repo Identity

| Field | Value |
|---|---|
| GitHub org | `crystalclearhouse-data` |
| Repo name | `crystal-clear-voices` |
| Default branch | `main` |
| Remote URL | `https://github.com/crystalclearhouse-data/crystal-clear-voices.git` |
| Production domain | `voice.thediscobass.com` |
| Brand | The Steele Zone |
| Primary contact | crystalclearhouse@icloud.com |

---

## CrewAI

- `X-Crewai-Organization-Id: a1751f49-7303-4399-8bab-e3b9b5f3d834`
- Agents may **read** CrewAI job status
- Agents may **not** kick off CrewAI crew runs without user approval
- Agents may **not** store or log `CREWAI_API_KEY`

---

*Last updated: 2026-02-27*
