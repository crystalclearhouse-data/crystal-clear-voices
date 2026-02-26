import fs from 'fs';
import path from 'path';

type Workflow = {
  id: string;
  name: string;
  category?: string;
  status?: string;
  path: string;
  [k: string]: unknown;
};

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const indexPath = path.join(projectRoot, 'workflows', 'index.json');

function loadIndex(): Workflow[] {
  try {
    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.json not found at ${indexPath}`);
    }
    const raw = fs.readFileSync(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('workflows index.json must be an array');
    return parsed as Workflow[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to load workflows index:', msg);
    process.exit(1);
  }
}

function listWorkflows(): void {
  const list = loadIndex();
  console.log('ID'.padEnd(36), 'CATEGORY'.padEnd(20), 'STATUS'.padEnd(12), 'NAME');
  console.log('-'.repeat(90));
  for (const w of list) {
    const id = (w.id ?? '').toString();
    const category = (w.category ?? '').toString();
    const status = (w.status ?? '').toString();
    const name = (w.name ?? '').toString();
    console.log(id.padEnd(36), category.padEnd(20), status.padEnd(12), name);
  }
}

function showWorkflow(id: string): void {
  const list = loadIndex();
  const wf = list.find((x) => x.id === id);
  if (!wf) {
    console.error(`Workflow not found: ${id}`);
    process.exit(2);
  }

  console.log('--- METADATA ---');
  console.log(JSON.stringify(wf, null, 2));

  const readmePath = path.join(projectRoot, wf.path, 'README.md');
  if (fs.existsSync(readmePath)) {
    console.log('\n--- README.md ---\n');
    const md = fs.readFileSync(readmePath, 'utf8');
    console.log(md);
  } else {
    console.log(`\nNo README.md found at ${readmePath}`);
  }
}

function printUsage(): void {
  console.log('Usage: node cli.js [list] | show <workflow-id>');
  console.log('Commands:');
  console.log('  list               List all workflows');
  console.log('  show <workflow-id> Show metadata and README for a workflow');
}

function main(): void {
  const [, , cmd, arg] = process.argv;
  if (!cmd || cmd === 'list') {
    listWorkflows();
    return;
  }

  if (cmd === 'show') {
    if (!arg) {
      console.error('Missing workflow id. Example: show sophie-engagement-webhook');
      printUsage();
      process.exit(1);
    }
    showWorkflow(arg);
    return;
  }

  printUsage();
  process.exit(1);
}

main();
