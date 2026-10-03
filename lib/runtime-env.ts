import { env } from 'cloudflare:workers';
export const runtimeEnv = env as unknown as Record<string,string|undefined>;
