import { spawn } from 'node:child_process';
const fixtures=spawn(process.execPath,['scripts/preview-fixtures.mjs'],{stdio:'inherit'});
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3011'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55888',NEXT_PUBLIC_SUPABASE_ANON_KEY:'preview-key',SUPABASE_SERVICE_KEY:'preview-service',OPENAI_API_KEY:'',CRON_SECRET:'',NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:'',POSTHOG_PERSONAL_API_KEY:'',NEXT_PUBLIC_LIVE_CHAT_ENABLED:'false'}});
let closing=false;
function close(code=0){if(closing)return;closing=true;fixtures.kill('SIGTERM');app.kill('SIGTERM');process.exitCode=code;}
process.on('SIGINT',()=>close());process.on('SIGTERM',()=>close());
fixtures.on('exit',code=>close(code??0));app.on('exit',code=>close(code??0));
