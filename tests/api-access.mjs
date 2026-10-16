import { readdirSync, readFileSync } from 'node:fs';
const base = process.env.TEST_BASE_URL;
if (!base || !['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Set TEST_BASE_URL to the local preview using read-only fixture data.');
const routes=[];
for (const dir of readdirSync('src/app/api/admin')) {
 const file=`src/app/api/admin/${dir}/route.ts`;
 try { for (const match of readFileSync(file,'utf8').matchAll(/export async function (GET|POST|PATCH|DELETE|PUT)\(/g)) routes.push({path:'/api/admin/'+dir,method:match[1]}); } catch {}
}
for (const path of ['/api/scheduler/tick','/api/scraper','/api/generate-article']) for(const method of ['GET','POST']) routes.push({path,method});
for (const route of routes) {
 const response=await fetch(base+route.path,{method:route.method});
 if(response.status!==401) throw new Error(`${route.method} ${route.path}: expected 401, got ${response.status}`);
}
console.log(`${routes.length} protected API handlers rejected anonymous requests.`);
