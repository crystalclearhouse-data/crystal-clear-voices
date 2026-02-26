import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const indexPath = path.join(root, 'workflows', 'index.json');

function loadIndex() {
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to read index:', msg);
    process.exit(1);
  }
}

function listWorkflows() {
  const list = loadIndex();
  console.log('\nWorkflows:');
  console.log('='.repeat(80));
  list.forEach((w: any) => {
    console.log(`${w.id} | ${w.category} | ${w.status} | ${w.name}`);
  });
  console.log('='.repeat(80));
}

function showWorkflow(id: string) {
  const list = loadIndex();
  const wf = list.find((x: any) => x.id === id);
  if (!wf) {
    console.error('Workflow not found:', id);
    process.exit(2);
  }
  console.log(JSON.stringify(wf, null, 2));
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'list') {
  listWorkflows();
} else if (cmd === 'show' && arg) {
  showWorkflow(arg);
} else {
  console.log('Usage: list | show <id>');
}
