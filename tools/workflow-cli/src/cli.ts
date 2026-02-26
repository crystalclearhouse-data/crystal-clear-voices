import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

type Workflow = {
  id: string;
  name: string;
  category?: string;
  status?: string;
  path: string;
  [k: string]: unknown;
};

type Intent = {
  action: 'list' | 'show' | 'search' | 'help';
  workflowId?: string;
  query?: string;
  raw: string;
};

type AuthState = {
  tokenHash: string;
  createdAt: string;
};

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const indexPath = path.join(projectRoot, 'workflows', 'index.json');
const authDir = path.join(os.homedir(), '.cch-workflow-cli');
const authPath = path.join(authDir, 'auth.json');

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
  renderWorkflowTable(list);
}

function renderWorkflowTable(list: Workflow[]): void {
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

function searchWorkflows(query: string): Workflow[] {
  const needle = query.toLowerCase().trim();
  if (!needle) return [];
  return loadIndex().filter((workflow) => {
    const haystack = [workflow.id, workflow.name, workflow.category, workflow.status]
      .map((value) => (value ?? '').toString().toLowerCase())
      .join(' ');
    return haystack.includes(needle);
  });
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
  console.log('Usage: npm run start -- <command>');
  console.log('Commands:');
  console.log('  list               List all workflows');
  console.log('  show <workflow-id> Show metadata and README for a workflow');
  console.log('  auth login --token <token>   Save auth token hash locally');
  console.log('  auth status                  Show current auth status');
  console.log('  auth logout                  Remove local auth state');
  console.log('  voice "<spoken command>"     Run authenticated voice command');
  console.log('  mcp "<spoken command>"       Build MCP envelope and execute');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readAuthState(): AuthState | null {
  if (!fs.existsSync(authPath)) return null;
  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed.tokenHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAuthState(state: AuthState): void {
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(authPath, JSON.stringify(state, null, 2), 'utf8');
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function authLogin(token?: string): void {
  const value = token?.trim();
  if (!value) {
    console.error('Missing token. Example: auth login --token my-secret-token');
    process.exit(1);
  }
  writeAuthState({ tokenHash: hashToken(value), createdAt: new Date().toISOString() });
  console.log('Auth token saved. Set WORKFLOW_CLI_TOKEN in your shell for authenticated commands.');
}

function authStatus(): void {
  const state = readAuthState();
  if (!state) {
    console.log('Auth not configured. Run: auth login --token <token>');
    return;
  }
  console.log(`Auth configured at ${state.createdAt}`);
  console.log(`Auth file: ${authPath}`);
}

function authLogout(): void {
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { force: true });
  }
  console.log('Auth state removed.');
}

function assertAuthenticated(): void {
  const state = readAuthState();
  if (!state) {
    console.error('Not authenticated. Run: auth login --token <token>');
    process.exit(1);
  }
  const runtimeToken = process.env.WORKFLOW_CLI_TOKEN;
  if (!runtimeToken) {
    console.error('Missing WORKFLOW_CLI_TOKEN environment variable.');
    process.exit(1);
  }
  if (hashToken(runtimeToken) !== state.tokenHash) {
    console.error('Authentication failed: token mismatch.');
    process.exit(1);
  }
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findWorkflowIdFromSpeech(raw: string, list: Workflow[]): string | undefined {
  const spoken = normalize(raw).replace(/\s+/g, '-');
  const exact = list.find((workflow) => spoken.includes(normalize(workflow.id)));
  if (exact) return exact.id;

  const near = list.find((workflow) => spoken.includes(normalize(workflow.id).replace(/\s+/g, '-')));
  return near?.id;
}

function parseIntent(raw: string): Intent {
  const command = normalize(raw);
  const list = loadIndex();

  if (!command || command === 'help') {
    return { action: 'help', raw };
  }

  if (command.includes('list') || command.includes('all workflows')) {
    return { action: 'list', raw };
  }

  const idFromSpeech = findWorkflowIdFromSpeech(raw, list);
  if ((command.startsWith('show ') || command.startsWith('open ') || command.includes('workflow')) && idFromSpeech) {
    return { action: 'show', workflowId: idFromSpeech, raw };
  }

  const match = command.match(/(?:find|search)\s+(.+)/);
  if (match?.[1]) {
    return { action: 'search', query: match[1].trim(), raw };
  }

  return { action: 'search', query: command, raw };
}

function executeIntent(intent: Intent): void {
  if (intent.action === 'help') {
    printUsage();
    return;
  }

  if (intent.action === 'list') {
    listWorkflows();
    return;
  }

  if (intent.action === 'show' && intent.workflowId) {
    showWorkflow(intent.workflowId);
    return;
  }

  if (intent.action === 'search' && intent.query) {
    const matches = searchWorkflows(intent.query);
    if (matches.length === 0) {
      console.log(`No workflows found for query: ${intent.query}`);
      return;
    }
    renderWorkflowTable(matches);
    return;
  }

  printUsage();
}

function buildMcpEnvelope(intent: Intent): Record<string, unknown> {
  return {
    protocol: 'mcp-1',
    timestamp: new Date().toISOString(),
    intent,
    auth: {
      mode: 'token-sha256',
      tokenHashPrefix: hashToken(process.env.WORKFLOW_CLI_TOKEN ?? '').slice(0, 12)
    }
  };
}

function main(): void {
  const [, , cmd, ...args] = process.argv;
  const arg = args[0];

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

  if (cmd === 'auth') {
    const sub = args[0];
    if (sub === 'login') {
      const token = getFlagValue(args, '--token');
      authLogin(token);
      return;
    }
    if (sub === 'status') {
      authStatus();
      return;
    }
    if (sub === 'logout') {
      authLogout();
      return;
    }
    printUsage();
    process.exit(1);
  }

  if (cmd === 'voice') {
    assertAuthenticated();
    const spoken = args.join(' ').trim();
    if (!spoken) {
      console.error('Missing voice command text. Example: voice "show sophie-engagement-webhook"');
      process.exit(1);
    }
    const intent = parseIntent(spoken);
    if (args.includes('--json')) {
      console.log(JSON.stringify(intent, null, 2));
      return;
    }
    executeIntent(intent);
    return;
  }

  if (cmd === 'mcp') {
    assertAuthenticated();
    const spoken = args.filter((part) => part !== '--dry-run').join(' ').trim();
    if (!spoken) {
      console.error('Missing voice command text. Example: mcp "find production workflows"');
      process.exit(1);
    }
    const intent = parseIntent(spoken);
    const envelope = buildMcpEnvelope(intent);
    console.log(JSON.stringify(envelope, null, 2));
    if (!args.includes('--dry-run')) {
      executeIntent(intent);
    }
    return;
  }

  printUsage();
  process.exit(1);
}

main();
