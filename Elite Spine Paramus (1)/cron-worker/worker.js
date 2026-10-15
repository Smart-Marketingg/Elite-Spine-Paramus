// Tiny scheduled Worker: once a week, asks the website to check Google posts and write blog drafts.
// Deploy:  cd cron-worker && npx wrangler deploy && npx wrangler secret put CRON_SECRET
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // Visiting the Worker URL does nothing useful on purpose.
  async fetch() { return new Response('Elite Spine weekly job. Nothing to see here.', { status: 404 }); }
};

async function run(env) {
  const r = await fetch((env.SITE_URL || 'https://www.elitespineparamus.com') + '/api/cron/weekly', {
    method: 'POST', headers: { 'X-Cron-Secret': env.CRON_SECRET, 'Content-Type': 'application/json' }
  });
  console.log('weekly job', r.status, await r.text());
}
