// mcp-paths.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global default project root (override per-server if needed)
export const DEFAULT_PROJECT_ROOT =
  process.env.PROJECT_ROOT || path.resolve(__dirname);

export function resolveUnderRoot(root, incomingPath) {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(incomingPath);

  if (
    resolved !== absoluteRoot &&
    !resolved.startsWith(absoluteRoot + path.sep)
  ) {
    throw new Error(`Access denied: path is outside allowed root`);
  }

  return resolved;
}
