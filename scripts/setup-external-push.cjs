// Generate once; reruns preserve the VAPID identity and Cron credential.
const fs = require('node:fs');
const crypto = require('node:crypto');
const webpush = require('web-push');
const dotenv = require('dotenv');
const path = '.env.push.local';
if (!fs.existsSync(path)) {
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(path, [
    `WEB_PUSH_PUBLIC_KEY=${keys.publicKey}`,
    `WEB_PUSH_PRIVATE_KEY=${keys.privateKey}`,
    'WEB_PUSH_SUBJECT=https://backoffice-pixel.vercel.app',
    `CRON_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'), { mode: 0o600, flag: 'wx' });
}
const env = dotenv.parse(fs.readFileSync(path));
if (!/^[a-f0-9]{64}$/.test(env.CRON_SECRET || '')) throw new Error('Invalid Cron secret');
for (const key of ['WEB_PUSH_PUBLIC_KEY','WEB_PUSH_PRIVATE_KEY','WEB_PUSH_SUBJECT']) {
  if (!env[key]) throw new Error(`Missing ${key}`);
}
const vault = `-- Private generated setup: never commit or share this file.\n` +
`do $$ begin\n` +
` if exists(select 1 from vault.decrypted_secrets where name='external_push_cron_secret' and decrypted_secret <> '${env.CRON_SECRET}') then\n` +
`  raise exception 'Existing Cron secret differs; reconcile before replacing';\n` +
` end if;\n` +
` if not exists(select 1 from vault.secrets where name='external_push_cron_secret') then\n` +
`  perform vault.create_secret('${env.CRON_SECRET}', 'external_push_cron_secret', 'External machine notification dispatcher only');\n` +
` end if;\nend $$;\n`;
fs.writeFileSync('.env.push-cron.sql', vault + fs.readFileSync('supabase/manual/external_push_cron.sql', 'utf8'), { mode: 0o600 });
console.log('Push keys ready in .env.push.local; private Cron setup in .env.push-cron.sql (both gitignored).');
