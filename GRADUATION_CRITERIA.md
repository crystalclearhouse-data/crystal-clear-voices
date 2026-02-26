# Workflow Graduation Criteria

A framework for advancing n8n workflows from experimental stages into production status.

---

## Workflow Lifecycle

Every workflow at CrystalClearHouse follows a progression:

```
Unprocessed → Testing → Active (Production)
     ↓           ↓         ↓
  New/Raw    Validated   Live
```

---

## Stage Definitions

### 1) **Unprocessed**
- Newly added workflows, POCs, or brainstorms.
- May lack proper documentation or clear ownership.
- Not yet evaluated for feasibility or performance.
- **Duration**: Typically 0–2 weeks.

### 2) **Testing**
- Workflow has a clear purpose, inputs, and outputs documented.
- Actively being tested in non-production environments.
- Dependencies and integrations identified.
- Error handling and monitoring are in place.
- **Duration**: Typically 2–8 weeks.

### 3) **Active** (Production)
- Workflow operates reliably in production.
- Handles errors gracefully.
- Data is validated and transformed correctly.
- Team understands how to troubleshoot and iterate.

---

## Graduation Requirements

### To Graduate from **Unprocessed → Testing**

✅ **Documentation**
- Complete [WORKFLOW_README_TEMPLATE.md](workflows/templates/WORKFLOW_README_TEMPLATE.md):
  - Purpose (1–2 sentences)
  - Inputs and outputs defined
  - Dependencies listed
  - Owner/contact assigned
- Added to `workflows/index.json` with correct category

✅ **Feasibility**
- Core logic implemented and tested locally or in n8n sandbox
- Any external APIs/services are reachable
- No obvious blockers identified

✅ **Testing Plan**
- Test cases or smoke tests documented
- Example payloads included in README
- Edge cases identified

**Promotion Action**: Update `status` to `Testing` in `index.json`

---

### To Graduate from **Testing → Active** (Production-Ready)

✅ **Reliability**
- No unhandled errors in last 50+ test runs
- Response time acceptable (document expected SLA in README)
- Graceful failure modes for edge cases

✅ **Data Integrity**
- Inputs are validated
- Outputs are correct (spot-checks on 5+ real runs)
- Data transformations are logged or auditable
- No data loss or duplication observed

✅ **Monitoring & Alerting**
- Logs are captured (n8n execution logs, Slack/email alerts set up)
- Failure notifications configured
- Success metrics defined (e.g., "run completes in < 5min", "100% of records processed")

✅ **Performance**
- Load tested if applicable (typical volume doesn't exceed acceptable duration)
- Resource usage (CPU, memory) monitored
- No memory leaks or runaway processes

✅ **Handoff & Documentation**
- README is up-to-date with all sections completed
- Troubleshooting guide added (common failure scenarios + fixes)
- Runbook for on-call support available
- Owner confirmed and backup owner identified

✅ **Security & Compliance**
- Credentials handled securely (no hardcoding, use n8n secrets)
- Permissions appropriate (least privilege)
- Any PII or sensitive data properly masked in logs
- Compliance requirements met (e.g., retention, encryption)

**Promotion Action**: Update `status` to `Active` in `index.json`

---

## Graduation Checklist

Use this checklist when proposing a workflow for graduation:

```markdown
## [Workflow Name] → [Target Status]

- [ ] README completed (all sections)
- [ ] Documented in index.json
- [ ] Owner assigned and available
- [ ] No unhandled errors (last 50+ runs)
- [ ] Data spot-checked (5+ real runs pass)
- [ ] Monitoring/alerts configured
- [ ] Performance acceptable (SLA met)
- [ ] Troubleshooting guide written
- [ ] Security review complete
- [ ] Backup owner identified
- [ ] Team walkthrough scheduled/done

**Promoting from:** [Current Status]  
**Promoting to:** [New Status]  
**Promoted by:** [Your Name]  
**Date:** [YYYY-MM-DD]
```

---

## Demotion Criteria

A workflow may be **demoted** from Active → Testing if:
- Error rate exceeds 5% over 7 days
- Unresolved security issue identified
- Critical upstream dependency becomes unavailable
- SLA violations occur 3+ times in a week
- Owner unavailable and no backup can manage it

**Action**: Update `status` to `Testing` in `index.json` and document reason in workflow README under "Change Log".

---

## Review Cadence

- **Weekly**: Check for Testing-stage workflows ready to graduate
- **Monthly**: Audit all Active workflows for health (uptime, error rate, performance)
- **Quarterly**: Archive any Active workflows no longer in use

---

## Tools & Commands

### View workflow status
```bash
npm --prefix tools/workflow-cli run start -- list
```

### Show a specific workflow
```bash
npm --prefix tools/workflow-cli run start -- show <workflow-id>
```

### Update status manually
Edit `workflows/index.json` and change the `status` field for the workflow. Commit and push to notify the team.

### View dashboard
```bash
npx http-server .
# Open http://localhost:8080/dashboard/index.html
```

---

## Examples

### Example 1: Sophie Engagement Webhook → Active

**Current Status**: Active (already in production)  
**Last Review**: 2026-02-25  
**Health**: ✅ All metrics above SLA

### Example 2: Agent Zero → Testing

**Current Status**: Testing  
**Initiated**: 2026-02-01  
**Next Review**: 2026-02-28  

**Blockers**:
- Awaiting Claude API access (Dev ticket: #1234)
- Needs load test (estimate 1 week)

**Next Steps**: Complete API access, run 100+ test cycles, schedule promotion review.

---

## Ownership & Review

- **Primary**: @the_steele_zone
- **Secondary**: Team lead
- **Review Frequency**: Monthly (all workflows), Quarterly (deep dives)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-25 | 1.0 | Initial framework created |

