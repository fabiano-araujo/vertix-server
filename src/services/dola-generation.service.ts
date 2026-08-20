import axios from 'axios';
import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type DolaJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DolaReferenceInput = {
  id?: string;
  label?: string;
  url?: string;
  path?: string;
};

export type CreateDolaJobInput = {
  prompt: string;
  takeId?: string;
  takeTitle?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  model?: string;
  creditProfile?: string;
  references?: DolaReferenceInput[];
  profiles?: number[];
};

export type DolaJob = {
  id: string;
  status: DolaJobStatus;
  progress: number;
  message: string;
  takeId?: string;
  profile?: number;
  creditProfile: string;
  videoUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const SESSION_CANDIDATES = [
  process.env.DOLA_SESSION_FILE,
  'C:/Users/Fabiano/dola-launcher/dola-session.json',
  path.resolve(process.cwd(), '../dola-session.json'),
  path.resolve(process.cwd(), 'dola-session.json'),
].filter(Boolean) as string[];

const DEFAULT_SESSION_FILE =
  SESSION_CANDIDATES.find((file) => fs.existsSync(file)) || SESSION_CANDIDATES[0];
const DEFAULT_PROFILE_ROOT =
  process.env.DOLA_PROFILE_ROOT || 'C:/Users/Fabiano/playwright-profiles';
const DEFAULT_PLAYWRIGHT_MODULE =
  process.env.DOLA_PLAYWRIGHT_MODULE ||
  'C:/Users/Fabiano/dola-launcher/node_modules/playwright';
const DEFAULT_BROWSER_EXECUTABLE =
  process.env.DOLA_BROWSER_EXECUTABLE ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEFAULT_BROWSER_RUNNER =
  process.env.DOLA_BROWSER_RUNNER ||
  'C:/Users/Fabiano/.codex/skills/seedance-series-pipeline/scripts/dola_generate_take.js';
const DEFAULT_MODEL = process.env.DOLA_MODEL || 'Dreamina Seedance 2.5';
const DEFAULT_CREDIT_PROFILE = process.env.DOLA_CREDIT_PROFILE || 'Pre-Writes';
const PUBLIC_PREFIX = '/dola-runs';
const MAX_PROFILE_ATTEMPTS = Number(process.env.DOLA_MAX_PROFILE_ATTEMPTS || 3);

const jobs = new Map<string, DolaJob>();
const runners = new Map<string, ChildProcess>();

const looksLikeJsonBlob = (text: string) =>
  /^\s*\{/.test(text) || /"event"\s*:/.test(text);

const extractProviderSentence = (raw: string) => {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /Para proteger os direitos de imagem[\s\S]{0,400}?baseado em texto\.?/i,
    /Para proteger os direitos autorais[\s\S]{0,400}?(?:tente novamente|try again)\.?/i,
    /To protect image rights[\s\S]{0,400}?(?:text-based video|based on text)\.?/i,
    /To protect copyright[\s\S]{0,400}?(?:try again|edit the prompt)[^.]*\.?/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[0].replace(/\s+/g, ' ').trim();
  }
  return '';
};

export const describeDolaError = (raw: string) => {
  const text = String(raw || '').trim();
  const providerSentence = extractProviderSentence(text);
  if (providerSentence) return providerSentence;
  if (/interrompida|cancelled by user/i.test(text)) {
    return 'Geração interrompida.';
  }
  if (/DOLA_DAILY_LIMIT|daily_limit/i.test(text)) {
    return 'Este perfil Dola já usou o crédito de hoje. Tente gerar de novo para usar outro perfil.';
  }
  if (/DOLA_HIGH_DEMAND|high_demand/i.test(text)) {
    return 'O Dola está com alta demanda. Espere alguns minutos e tente de novo.';
  }
  if (/DOLA_AUTH_LOST|authentication_lost|AUTH_LOST/i.test(text)) {
    return 'A sessão do Dola expirou neste perfil. Faça login de novo e tente gerar outra vez.';
  }
  if (/DOLA_REJECTED_NO_POINT|rejected_before_consumption|REJECTED_NO_POINT/i.test(text)) {
    return 'O Dola recusou a cena antes de gastar crédito. Revise o prompt e as referências.';
  }
  if (/DOLA_DURATION_CLARIFICATION|duration_clarification/i.test(text)) {
    return 'O Dola pediu para confirmar a duração. Gere de novo com 5s ou 10s.';
  }
  if (/DOLA_TERMINAL_REJECTION|terminal_rejection/i.test(text)) {
    return 'O Dola recusou a cena por direitos de imagem, copyright ou áudio. Ajuste as referências ou o prompt.';
  }
  if (/DOLA_UNRECOGNIZED_RESPONSE|unrecognized_provider_response/i.test(text)) {
    return 'O Dola não confirmou a geração. Tente de novo.';
  }
  if (/DOLA_CONFIRMATION_UNRESOLVED|confirmation_unresolved/i.test(text)) {
    return 'O Dola não iniciou a geração depois da confirmação. Tente de novo.';
  }
  if (/DOLA_TIMEOUT|Timed out after/i.test(text)) {
    return 'O Dola estourou o tempo de espera. Tente gerar de novo.';
  }
  if (/ECONNREFUSED|não está no ar/i.test(text)) {
    return 'O gerador Dola local não está no ar. Rode yarn dola:serve na pasta server/.';
  }
  const cleaned = text
    .replace(/^profile-\d+:\s*/i, '')
    .replace(/^DOLA_[A-Z0-9_]+:\s*/i, '')
    .trim();
  if (!cleaned || looksLikeJsonBlob(cleaned)) {
    return 'Falha ao gerar no Dola.';
  }
  return cleaned;
};

const isCancelled = (job: DolaJob) =>
  (jobs.get(job.id) || job).status === 'cancelled';

const cancelledError = () => {
  const error = new Error('Geração interrompida.');
  (error as Error & { cancelled?: boolean }).cancelled = true;
  return error;
};

const killProcessTree = (child: ChildProcess) => {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      return;
    }
    child.kill('SIGTERM');
  } catch {
    child.kill();
  }
};

const runsRoot = () =>
  path.resolve(process.env.DOLA_RUNS_DIR || path.join(process.cwd(), 'public', 'dola-runs'));

const publicBaseUrl = () =>
  (process.env.DOLA_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.DOLA_LOCAL_PORT || 3847}`).replace(
    /\/$/,
    '',
  );

const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const touchJob = (job: DolaJob, patch: Partial<DolaJob>) => {
  const next = {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, next);
  return next;
};

const readSession = (sessionFile: string): Record<string, any> => {
  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Arquivo de sessão Dola não encontrado: ${sessionFile}`);
  }
  return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
};

export const listAvailableProfiles = (sessionFile = DEFAULT_SESSION_FILE) => {
  const session = readSession(sessionFile);
  const today = todayKey();
  const rows = Object.entries(session)
    .map(([key, value]) => {
      const match = /^profile-(\d+)$/.exec(key);
      if (!match || !value || typeof value !== 'object') return null;
      const authenticated =
        (value.status === 'ok' || value.status === 'ja_logado') && value.dola === true;
      const availableOn = String(value.dolaAvailableOn || '');
      const available = authenticated && (!availableOn || availableOn <= today);
      return {
        profile: Number(match[1]),
        authenticated,
        available,
        usedOn: value.dolaUsedOn || null,
        usedAt: value.dolaUsedAt || null,
        availableOn: value.dolaAvailableOn || null,
        usageState: value.dolaUsageState || null,
        lastModel: value.dolaLastModel || null,
      };
    })
    .filter(Boolean) as Array<{
    profile: number;
    authenticated: boolean;
    available: boolean;
    usedOn: string | null;
    usedAt: string | null;
    availableOn: string | null;
    usageState: string | null;
    lastModel: string | null;
  }>;

  const available = rows
    .filter((row) => row.available)
    .sort((a, b) => {
      const modelRank = (row: typeof a) => (row.lastModel === DEFAULT_MODEL ? 0 : 1);
      const usedRank = (row: typeof a) => (row.usedOn ? 0 : 1);
      const usedOnValue = (row: typeof a) => Number(String(row.usedOn || '0000-00-00').replace(/-/g, ''));
      return (
        modelRank(a) - modelRank(b) ||
        usedRank(a) - usedRank(b) ||
        usedOnValue(b) - usedOnValue(a) ||
        a.profile - b.profile
      );
    });

  return {
    today,
    sessionFile,
    creditProfile: DEFAULT_CREDIT_PROFILE,
    availableCount: available.length,
    available: available.map((row) => row.profile),
    profiles: rows.sort((a, b) => a.profile - b.profile),
  };
};

const sanitizePrompt = (raw: string) => {
  let prompt = String(raw || '').replace(/\r\n/g, '\n').trim();
  prompt = prompt.replace(/\bDreamina\s+Seedance\s+2\.5\b/gi, '');
  prompt = prompt.replace(/\b(?:9\s*:\s*16|16\s*:\s*9)\b/g, '');
  prompt = prompt.replace(/^\s*(?:an?\s+)?(?:exact\s+)?\d+(?:\.\d+)?[- ]seconds?(?:\s+long)?\s+/gim, '');
  prompt = prompt.replace(/\b(?:duration|length)\s*(?:is|:|of)?\s*\d+(?:\.\d+)?\s*(?:seconds?|s)\b/gi, '');
  return prompt.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

const extensionFor = (url: string, contentType?: string) => {
  const fromUrl = path.extname(new URL(url, 'https://vertix.local').pathname).toLowerCase();
  if (fromUrl && fromUrl.length <= 5) return fromUrl;
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return '.jpg';
  if (contentType?.includes('mp4')) return '.mp4';
  return '.png';
};

const materializeReferences = async (references: DolaReferenceInput[], directory: string) => {
  const files: string[] = [];
  for (const [index, reference] of references.entries()) {
    const localPath = String(reference.path || '').trim();
    if (localPath && fs.existsSync(localPath)) {
      files.push(localPath);
      continue;
    }
    const url = String(reference.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    const extension = extensionFor(url, String(response.headers['content-type'] || ''));
    const slug = String(reference.id || reference.label || `ref-${index + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `ref-${index + 1}`;
    const file = path.join(directory, `${slug}${extension}`);
    fs.writeFileSync(file, Buffer.from(response.data));
    files.push(file);
  }
  return files;
};

const waitForRunner = (
  jobId: string,
  command: string,
  args: string[],
  cwd: string,
  onEvent?: (event: Record<string, unknown>) => void,
) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: false,
      env: process.env,
    });
    runners.set(jobId, child);
    let stdout = '';
    let stderr = '';
    let lineBuffer = '';
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      lineBuffer += text;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          onEvent?.(JSON.parse(trimmed) as Record<string, unknown>);
        } catch {
          continue;
        }
      }
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (runners.get(jobId) === child) runners.delete(jobId);
      reject(error);
    });
    child.on('close', (code) => {
      if (runners.get(jobId) === child) runners.delete(jobId);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

const parseJsonLines = (stdout: string) => {
  const rows: Record<string, any>[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return rows;
};

const parseRunnerPayload = (stdout: string) => {
  const rows = parseJsonLines(stdout);
  const failure = [...rows].reverse().find((row) => row && row.ok === false);
  if (failure) return failure;
  const recorded = [...rows].reverse().find((row) => row && (row.recorded || row.message));
  if (recorded) return recorded;
  return rows.at(-1) || null;
};

const humanizeRunnerEvent = (event: Record<string, any>) => {
  const message = String(event?.message || '').trim();
  if (message && !looksLikeJsonBlob(message) && (event.ok === false || event.event === 'provider_error')) {
    return message;
  }
  const name = String(event?.event || '');
  const value = String(event?.value || '').trim();
  const control = String(event?.control || '').trim();
  if (name === 'provider_control_confirmed') {
    if (/duration/i.test(control)) return `Duração ${value} confirmada no Dola`;
    if (/aspect/i.test(control)) return `Proporção ${value} confirmada no Dola`;
    if (/credit/i.test(control)) return `Perfil ${value} confirmado no Dola`;
    return `${control} ${value} confirmado no Dola`.trim();
  }
  if (name === 'references_ready') {
    return `${Number(event.count || 0)} referências prontas no Dola`;
  }
  if (name === 'references_verified_before_send') {
    return 'Referências conferidas · enviando a cena...';
  }
  if (name === 'dola_google_reauthenticated' || name === 'provider_login_completed') {
    return 'Sessão do Dola revalidada.';
  }
  return null;
};

const runnerFailureMessage = (
  result: { code: number; stdout: string; stderr: string },
  payload: Record<string, any> | null,
) => {
  const fromPayload = String(payload?.message || payload?.provider_message || '').trim();
  if (fromPayload && !looksLikeJsonBlob(fromPayload)) return fromPayload;
  const stderr = String(result.stderr || '');
  const codeLine = stderr.match(/DOLA_[A-Z0-9_]+[^\n]*/);
  if (codeLine?.[0]) return codeLine[0];
  const recorded = String(payload?.recorded || '').trim();
  if (recorded && !looksLikeJsonBlob(recorded)) return recorded;
  return '';
};

const runWithProfile = async (params: {
  job: DolaJob;
  workDir: string;
  promptFile: string;
  promptHash: string;
  referenceFiles: string[];
  outputFile: string;
  profile: number;
  durationSeconds: number;
  aspectRatio: string;
  model: string;
  creditProfile: string;
  onEvent?: (event: Record<string, unknown>) => void;
}) => {
  const jobFile = path.join(params.workDir, `job-profile-${params.profile}.json`);
  const payload = {
    take_id: params.job.takeId || params.job.id,
    profile: params.profile,
    session_file: DEFAULT_SESSION_FILE,
    profile_root: DEFAULT_PROFILE_ROOT,
    playwright_module: DEFAULT_PLAYWRIGHT_MODULE,
    browser_executable: DEFAULT_BROWSER_EXECUTABLE,
    url: process.env.DOLA_URL || 'https://www.dola.com/chat/',
    model: params.model,
    credit_profile: params.creditProfile,
    duration_seconds: params.durationSeconds,
    aspect_ratio: params.aspectRatio,
    headless: false,
    timeout_minutes: Number(process.env.DOLA_TIMEOUT_MINUTES || 15),
    reference_upload_timeout_seconds: 180,
    reference_upload_settle_ms: 3000,
    prompt_file: params.promptFile,
    prompt_sha256: params.promptHash,
    references: params.referenceFiles,
    allow_empty_references: params.referenceFiles.length === 0,
    output: params.outputFile,
    meta_output: path.join(params.workDir, `meta-profile-${params.profile}.json`),
    error_screenshot: path.join(params.workDir, `error-profile-${params.profile}.png`),
    browser_close_delay_seconds: Number(
      process.env.DOLA_BROWSER_CLOSE_DELAY_SECONDS || 30,
    ),
  };
  fs.writeFileSync(jobFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return waitForRunner(
    params.job.id,
    process.execPath,
    [DEFAULT_BROWSER_RUNNER, '--job', jobFile],
    params.workDir,
    params.onEvent,
  );
};

const executeJob = async (job: DolaJob, input: CreateDolaJobInput) => {
  const prompt = sanitizePrompt(input.prompt);
  if (!prompt) {
    throw new Error('O prompt da cena está vazio.');
  }
  if (!fs.existsSync(DEFAULT_BROWSER_RUNNER)) {
    throw new Error(`Runner Dola não encontrado: ${DEFAULT_BROWSER_RUNNER}`);
  }
  if (!fs.existsSync(DEFAULT_BROWSER_EXECUTABLE)) {
    throw new Error(`Chrome estável não encontrado: ${DEFAULT_BROWSER_EXECUTABLE}`);
  }

  const inventory = listAvailableProfiles();
  const requested = (input.profiles || [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const availableSet = new Set(inventory.available);
  const selected = requested.length
    ? requested.filter((profile) => availableSet.has(profile))
    : inventory.available;
  if (!selected.length) {
    throw new Error('Nenhum perfil Dola disponível hoje no dola-session.json.');
  }

  const workDir = path.join(runsRoot(), job.id);
  fs.mkdirSync(workDir, { recursive: true });
  const promptFile = path.join(workDir, 'prompt.txt');
  fs.writeFileSync(promptFile, prompt, 'utf8');
  const promptHash = crypto.createHash('sha256').update(prompt.replace(/\r\n/g, '\n').replace(/\n$/, ''), 'utf8').digest('hex');
  const referenceFiles = await materializeReferences(input.references || [], workDir);
  const outputFile = path.join(workDir, 'output.mp4');
  const candidates = selected;
  const errors: string[] = [];

  touchJob(job, {
    status: 'running',
    progress: 0.12,
    message: `Usando perfil Dola ${candidates[0]} · ${DEFAULT_CREDIT_PROFILE}`,
    profile: candidates[0],
  });

  for (const profile of candidates) {
    if (isCancelled(job)) throw cancelledError();
    const current = jobs.get(job.id) || job;
    touchJob(current, {
      status: 'running',
      progress: 0.22,
      profile,
      message: `Abrindo Dola no perfil ${profile} com ${DEFAULT_CREDIT_PROFILE}...`,
    });
    const result = await runWithProfile({
      job: current,
      workDir,
      promptFile,
      promptHash,
      referenceFiles,
      outputFile,
      profile,
      durationSeconds: Number(input.durationSeconds || 10),
      aspectRatio: String(input.aspectRatio || '9:16'),
      model: String(input.model || DEFAULT_MODEL),
      creditProfile: String(input.creditProfile || DEFAULT_CREDIT_PROFILE),
      onEvent: (event) => {
        if (isCancelled(job)) return;
        const live = jobs.get(job.id);
        if (!live || live.status === 'cancelled' || live.status === 'completed') return;
        const message = humanizeRunnerEvent(event);
        if (!message) return;
        if (event.ok === false || event.event === 'provider_error') {
          const described = describeDolaError(message);
          const recorded = String(event.recorded || event.code || '');
          const retryable = [
            'daily_limit',
            'rejected_before_consumption',
            'high_demand',
            'authentication_lost',
          ].some((code) => recorded.includes(code)) ||
            /DOLA_(DAILY_LIMIT|REJECTED_NO_POINT|HIGH_DEMAND|AUTH_LOST)/.test(recorded);
          if (retryable) {
            touchJob(live, {
              status: 'running',
              message: `${described} Trocando de perfil...`,
            });
            return;
          }
          touchJob(live, {
            status: 'failed',
            error: described,
            message: described,
          });
          return;
        }
        if (live.status !== 'running' && live.status !== 'queued') return;
        const name = String(event.event || '');
        const nextProgress =
          name === 'references_verified_before_send'
            ? 0.58
            : name === 'references_ready'
              ? 0.46
              : name === 'provider_control_confirmed'
                ? Math.max(live.progress, 0.34)
                : live.progress;
        touchJob(live, {
          status: 'running',
          progress: Math.max(live.progress, nextProgress),
          message,
        });
      },
    });
    if (isCancelled(job)) throw cancelledError();
    const payload = parseRunnerPayload(result.stdout);
    if (result.code === 0 && fs.existsSync(outputFile)) {
      const videoUrl = `${publicBaseUrl()}${PUBLIC_PREFIX}/${job.id}/output.mp4`;
      touchJob(current, {
        status: 'completed',
        progress: 1,
        profile,
        videoUrl,
        message: `Vídeo gerado no perfil ${profile} · ${DEFAULT_CREDIT_PROFILE}`,
      });
      return;
    }

    const recorded = String(payload?.recorded || '');
    const failure = runnerFailureMessage(result, payload);
    const stderr = `${result.stderr}\n${failure}`.trim();
    const retryable = [
      'daily_limit',
      'rejected_before_consumption',
      'high_demand',
      'authentication_lost',
    ].includes(recorded) || /DOLA_(DAILY_LIMIT|REJECTED_NO_POINT|HIGH_DEMAND|AUTH_LOST)/.test(stderr);
    errors.push(`profile-${profile}: ${failure || recorded || `exit ${result.code}`}`);
    if (!retryable) {
      throw new Error(describeDolaError(failure || errors[errors.length - 1]));
    }
  }

  throw new Error(describeDolaError(`Nenhum perfil Dola conseguiu gerar: ${errors.join('; ')}`));
};

export const getDolaJob = (id: string) => jobs.get(id) || null;

export const createDolaJob = (input: CreateDolaJobInput) => {
  const id = uuidv4();
  const job: DolaJob = {
    id,
    status: 'queued',
    progress: 0.04,
    message: 'Selecionando perfil Dola disponível hoje...',
    takeId: input.takeId,
    creditProfile: String(input.creditProfile || DEFAULT_CREDIT_PROFILE),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  void executeJob(job, input).catch((error) => {
    const current = jobs.get(id) || job;
    if (current.status === 'cancelled' || error?.cancelled) {
      if (current.status !== 'cancelled') {
        touchJob(current, {
          status: 'cancelled',
          message: 'Geração interrompida.',
          error: 'Geração interrompida.',
        });
      }
      return;
    }
    const message = describeDolaError(error?.message || String(error));
    touchJob(current, {
      status: 'failed',
      progress: current.progress || 0.1,
      error: message,
      message,
    });
  });
  return job;
};

export const cancelDolaJob = (id: string) => {
  const job = jobs.get(id);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return job;
  }
  const child = runners.get(id);
  const cancelled = touchJob(job, {
    status: 'cancelled',
    progress: job.progress || 0.1,
    message: 'Geração interrompida.',
    error: 'Geração interrompida.',
  });
  if (child) killProcessTree(child);
  return cancelled;
};

export const dolaConfig = () => ({
  sessionFile: DEFAULT_SESSION_FILE,
  profileRoot: DEFAULT_PROFILE_ROOT,
  browserRunner: DEFAULT_BROWSER_RUNNER,
  creditProfile: DEFAULT_CREDIT_PROFILE,
  model: DEFAULT_MODEL,
  runsRoot: runsRoot(),
  publicPrefix: PUBLIC_PREFIX,
  hostname: os.hostname(),
});
