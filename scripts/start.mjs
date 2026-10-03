import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
// Resolve before Next's standalone server changes the working directory.
process.env.LEDGER_PATH = resolve(process.env.LEDGER_PATH || './data/usage.sqlite');
process.env.HOSTNAME = process.env.BIND_HOST || '127.0.0.1';
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
await import(pathToFileURL(resolve('.next/standalone/server.js')).href);
