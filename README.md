# CrystalClearHouse Workflows

A management system for 28 n8n automation workflows organized by category, with CLI tools, web dashboard, and graduation criteria for moving workflows from experiments to production.

## 📂 Project Structure

```
├── workflows/                  # 28 n8n workflows organized by category
│   ├── Production/            # 3 active production workflows
│   ├── Agent-Experiments/     # 5 AI agent pattern tests
│   ├── Connector-Explorations/# 5 integration experiments
│   ├── Content-Creation/      # 3 AI content generators
│   ├── Infrastructure/        # 2 system automation workflows
│   ├── Other/                 # 10 unprocessed/experimental
│   ├── index.json            # Master workflow index (status, metadata)
│   └── templates/            # README templates
├── tools/workflow-cli/        # Node.js/TypeScript CLI
├── dashboard/                 # Web dashboard (HTML + Chart.js)
└── GRADUATION_CRITERIA.md    # Framework for workflow promotion

```

## 🚀 Quick Start

### View all workflows (CLI)
```bash
npm --prefix tools/workflow-cli install
npm --prefix tools/workflow-cli run start -- list
```

### Show a specific workflow
```bash
npm --prefix tools/workflow-cli run start -- show sophie-engagement-webhook
```

### View web dashboard
```bash
npx http-server .
# Open http://localhost:8080/dashboard/index.html
```

## 📊 Dashboard Features

- **Stats Cards**: Total, Active, Testing, Categories
- **Status Chart**: Doughnut chart showing workflow distribution
- **Category Breakdown**: Count per category
- **Search & Filters**: Filter by category or search by name/id
- **Real-time Polling**: Auto-refreshes every 5 minutes

## 📝 Workflow Status

| Status | Count | Description |
|--------|-------|-------------|
| Active | 5 | Production-ready, live workflows |
| Testing | 13 | Being validated, not yet production |
| Unprocessed | 10 | New/raw, not yet evaluated |

## 🎓 Graduation Criteria

Workflows move through stages:
```
Unprocessed → Testing → Active (Production)
```

See [GRADUATION_CRITERIA.md](GRADUATION_CRITERIA.md) for full requirements.

## 🛠️ Tech Stack

- **n8n**: Workflow automation platform
- **Supabase**: Database backend
- **Node.js/TypeScript**: CLI tooling
- **Chart.js**: Dashboard visualizations
- **VSCode**: Primary IDE

## 📁 Workflow Categories

### Production (3)
- Sophie Engagement Webhook
- Sophie Daily TikTok Report
- TheSteezeZone Email Signup

### Agent Experiments (5)
- Agent Zero
- Sophie Trend Agent
- DiscoAgents Social Traffic
- DiscoAgents Orchestrator
- Sophie Vault Check

### Connector Explorations (5)
- Sophie Notion Connector Plan
- Sophie ClickUp Connector Plan
- Sophie Notion Stub
- Sophie ClickUp Stub
- Gumroad to Claude to GitHub

### Content Creation (3)
- NanoBanana video creator
- Sophie AI Report Transform
- Sophie Repost Discord

### Infrastructure (2)
- n8n Audit Report Generator
- My workflow 3

## 📦 CLI Commands

### List all workflows
```bash
npm --prefix tools/workflow-cli run start -- list
```

### Show workflow details + README
```bash
npm --prefix tools/workflow-cli run start -- show <workflow-id>
```

Example:
```bash
npm --prefix tools/workflow-cli run start -- show agent-zero
```

## 🎯 Adding a New Workflow

1. Create folder: `workflows/<Category>/<workflow-name>/`
2. Add README using template: `workflows/templates/WORKFLOW_README_TEMPLATE.md`
3. Add entry to `workflows/index.json`:
   ```json
   {
     "id": "my-new-workflow",
     "name": "My New Workflow",
     "category": "Agent Experiments",
     "status": "Testing",
     "path": "workflows/Agent-Experiments/my-new-workflow"
   }
   ```
4. Commit and push

## 👤 Owner

[@the_steele_zone](https://github.com/the_steele_zone)

## 📄 License

Private repository — internal use only.

---

**Last Updated**: February 25, 2026
