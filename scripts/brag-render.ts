/**
 * Local Hyperframes render for a brag job (when Vercel only produced plan_ready).
 * Usage: npm run brag:render -- <job-uuid>
 */
import { rerenderBragJob } from "../src/lib/server/bragPipeline";

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error("Usage: npm run brag:render -- <job-uuid>");
  process.exit(1);
}

rerenderBragJob(jobId)
  .then((job) => {
    console.log(JSON.stringify(job, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
