import axios from 'axios';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type DolaJobStatus = 'queued' | 'running' | 'completed' | 'failed';

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

const DEFAULT_SESSION_FILE =
  process.env.DOLA_SESSION_FILE ||
  'C:/Users/Fabiano/dola-launcher/dola-session.json';
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

const waitForRunner = (command: string, args: string[], cwd: string) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: false,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });

const parseRunnerPayload = (stdout: string) => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  return null;
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
  };
  fs.writeFileSync(jobFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return waitForRunner(process.execPath, [DEFAULT_BROWSER_RUNNER, '--job', jobFile], params.workDir);
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
  if (!inventory.available.length) {
    throw new Error('Nenhum perfil Dola disponível hoje no dola-session.json.');
  }

  const workDir = path.join(runsRoot(), job.id);
  fs.mkdirSync(workDir, { recursive: true });
  const promptFile = path.join(workDir, 'prompt.txt');
  fs.writeFileSync(promptFile, prompt, 'utf8');
  const promptHash = crypto.createHash('sha256').update(prompt.replace(/\r\n/g, '\n').replace(/\n$/, ''), 'utf8').digest('hex');
  const referenceFiles = await materializeReferences(input.references || [], workDir);
  const outputFile = path.join(workDir, 'output.mp4');
  const candidates = inventory.available.slice(0, Math.max(1, MAX_PROFILE_ATTEMPTS));
  const errors: string[] = [];

  touchJob(job, {
    status: 'running',
    progress: 0.12,
    message: `Usando perfil Dola ${candidates[0]} · ${DEFAULT_CREDIT_PROFILE}`,
    profile: candidates[0],
  });

  for (const profile of candidates) {
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
    });
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
    const stderr = `${result.stderr}\n${result.stdout}`.trim();
    const retryable = [
      'daily_limit',
      'rejected_before_consumption',
      'high_demand',
      'authentication_lost',
    ].includes(recorded) || /DOLA_(DAILY_LIMIT|REJECTED_NO_POINT|HIGH_DEMAND|AUTH_LOST)/.test(stderr);
    errors.push(`profile-${profile}: ${recorded || stderr.slice(-280) || `exit ${result.code}`}`);
    if (!retryable) {
      throw new Error(errors[errors.length - 1]);
    }
  }

  throw new Error(`Nenhum perfil Dola conseguiu gerar: ${errors.join('; ')}`);
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
    touchJob(current, {
      status: 'failed',
      progress: current.progress || 0.1,
      error: error?.message || String(error),
      message: error?.message || 'Falha ao gerar no Dola',
    });
  });
  return job;
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
