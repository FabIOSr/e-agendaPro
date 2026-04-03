import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const containerName = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_agendapro';
const sqlPath = new URL('./sql/db-smoke.sql', import.meta.url);
const sql = readFileSync(sqlPath, 'utf8');

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return result;
}

const dockerCheck = run('docker', ['ps', '--format', '{{.Names}}'], null);
if (dockerCheck.status !== 0) {
  console.error('Nao foi possivel consultar o Docker.');
  process.stderr.write(dockerCheck.stderr || '');
  process.exit(dockerCheck.status ?? 1);
}

const containers = dockerCheck.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (!containers.includes(containerName)) {
  console.error(`Container do banco local nao encontrado: ${containerName}`);
  console.error('Suba o ambiente antes com `supabase start`.');
  process.exit(1);
}

const execResult = run(
  'docker',
  ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  sql,
);

if (execResult.stdout) process.stdout.write(execResult.stdout);
if (execResult.stderr) process.stderr.write(execResult.stderr);

if (execResult.status !== 0) {
  console.error('Smoke test do banco falhou.');
  process.exit(execResult.status ?? 1);
}

console.log('Smoke test do banco passou.');
