import { env } from 'cloudflare:workers';
export function database(): D1Database { const db=(env as unknown as {DB?:D1Database}).DB; if(!db) throw new Error('Storage is unavailable. Your draft is preserved.'); return db; }
export function assets(): R2Bucket { const bucket=(env as unknown as {ASSETS_BUCKET?:R2Bucket}).ASSETS_BUCKET; if(!bucket) throw new Error('Website storage is unavailable.'); return bucket; }
