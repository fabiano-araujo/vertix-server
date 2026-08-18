import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

dotenv.config();

const OPENROUTER_VIDEO_BASE_URL = 'https://openrouter.ai/api/v1';
const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'bytedance/seedance-2.5';
const SEGMIND_SEEDANCE_ENDPOINT = process.env.SEGMIND_SEEDANCE_ENDPOINT || 'https://api.segmind.com/v1/seedance-2.0';
const MAX_AUDIO_REFERENCES = 3;

type VideoProvider = 'openrouter' | 'segmind' | 'wavespeed';

type ImagePart = {
  type: 'image_url';
  image_url: {
    url: string;
  };
};

type FrameImagePart = ImagePart & {
  frame_type: 'first_frame' | 'last_frame';
};

type SubmitVideoJobInput = {
  apiKey?: string;
  provider?: string;
  model?: string;
  label?: string;
  prompt: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  seed?: number;
  generateAudio?: boolean;
  uploadLastFrame?: boolean;
  inputReferenceUrls?: string[];
  referenceAudioUrls?: string[];
  firstFrameUrl?: string;
};

type VoiceReferenceClipInput = {
  character?: string;
  label?: string;
  voiceId?: string;
  voiceName?: string;
  text: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
};

type DubbingLineInput = {
  id?: string;
  speaker?: string;
  character?: string;
  voiceId?: string;
  voiceName?: string;
  text: string;
  translatedText?: string;
  start: number;
  end?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
};

type GenerateVoiceReferencesInput = {
  apiKey?: string;
  modelId?: string;
  outputFormat?: string;
  upload?: boolean;
  clips?: VoiceReferenceClipInput[];
};

type GenerateDubbingInput = {
  apiKey?: string;
  modelId?: string;
  outputFormat?: string;
  language?: string;
  label?: string;
  upload?: boolean;
  fitToWindow?: boolean;
  totalDuration?: number;
  videoUrl?: string;
  videoPath?: string;
  outputVideo?: boolean;
  keepOriginalAudioBed?: boolean;
  removeOriginalVocals?: boolean;
  originalVocalRemovalMode?: 'center_cancel' | 'none';
  originalAudioVolume?: number;
  musicUrl?: string;
  musicPath?: string;
  musicVolume?: number;
  ambienceUrl?: string;
  ambiencePath?: string;
  ambienceVolume?: number;
  sfxUrls?: string[];
  sfxPaths?: string[];
  sfxVolume?: number;
  dialogueVolume?: number;
  lines?: DubbingLineInput[];
  voices?: Record<string, string | { voiceId?: string }>;
};

type DownloadJobInput = {
  apiKey?: string;
  provider?: string;
  jobId: string;
  label?: string;
  index?: number;
  uploadLastFrame?: boolean;
};

type AssembleVideosInput = {
  take1Path: string;
  take2Path: string;
  label?: string;
};

const getApiKey = (apiKey?: string): string => {
  const key = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY ausente. Configure a chave no servidor.');
  }
  return key;
};

const getSegmindApiKey = (): string => {
  const key = (process.env.SEGMIND_API_KEY || '').trim();
  if (!key) {
    throw new Error('SEGMIND_API_KEY ausente. Configure a chave no servidor.');
  }
  return key;
};

const getWaveSpeedApiKey = (): string => {
  const key = (process.env.WAVESPEED_API_KEY || '').trim();
  if (!key) {
    throw new Error('WAVESPEED_API_KEY ausente. Configure a chave no servidor.');
  }
  return key;
};

const getElevenLabsApiKey = (apiKey?: string): string => {
  const key = (apiKey || process.env.ELEVENLABS_API_KEY || '').trim();
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY ausente. Configure a chave no servidor.');
  }
  return key;
};

const videoProvider = (value?: string): VideoProvider => {
  const normalized = String(value || 'openrouter').toLowerCase();
  if (normalized === 'segmind') return 'segmind';
  if (normalized === 'wavespeed') return 'wavespeed';
  return 'openrouter';
};

const openRouterHeaders = (apiKey?: string) => ({
  Authorization: `Bearer ${getApiKey(apiKey)}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3005',
  'X-Title': process.env.SITE_NAME || 'Vertix OpenRouter Video Studio',
});

const segmindHeaders = () => ({
  'x-api-key': getSegmindApiKey(),
  'Content-Type': 'application/json',
});

const waveSpeedHeaders = () => ({
  Authorization: `Bearer ${getWaveSpeedApiKey()}`,
  'Content-Type': 'application/json',
});

const cleanUrls = (urls?: string[]): string[] => {
  return (urls || [])
    .map((url) => String(url || '').trim())
    .filter(Boolean);
};

const audioReferenceUrls = (urls?: string[]): string[] => {
  const cleaned = cleanUrls(urls);
  if (cleaned.length > MAX_AUDIO_REFERENCES) {
    throw new Error(`Seedance 2.0 aceita no máximo ${MAX_AUDIO_REFERENCES} áudios de referência por take.`);
  }
  return cleaned;
};

const imageParts = (urls?: string[]): ImagePart[] => {
  return cleanUrls(urls).map((url) => ({
    type: 'image_url',
    image_url: { url },
  }));
};

const publicRoot = (): string => {
  return path.resolve(__dirname, '..', '..', 'public');
};

const runsDir = (): string => {
  const dir = path.join(publicRoot(), 'openrouter-video-runs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const safeLabel = (label?: string): string => {
  const cleaned = String(label || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || 'video';
};

const DEFAULT_ELEVENLABS_VOICES: Record<string, string> = {
  lia: 'EXAVITQu4vr4xnSDxMaL',
  noah: 'IKne3meq5aSn9XLyUdCD',
  bia: 'cgSgspJ2msm6clMCkdW9',
  hyerin: 'XrExE9yKIg1WjnnlVkGX',
  'hye-rin': 'XrExE9yKIg1WjnnlVkGX',
  kang: 'pNInz6obpgDQGcFmaJgB',
  presidente: 'pNInz6obpgDQGcFmaJgB',
};

const voiceKey = (clip: VoiceReferenceClipInput): string => {
  return `${clip.character || clip.label || clip.voiceName || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const voiceIdForClip = (clip: VoiceReferenceClipInput): string => {
  if (clip.voiceId?.trim()) return clip.voiceId.trim();
  const key = voiceKey(clip);
  const matched = Object.entries(DEFAULT_ELEVENLABS_VOICES).find(([name]) => key.includes(name));
  if (matched) return matched[1];
  return DEFAULT_ELEVENLABS_VOICES.lia;
};

const runId = (): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${crypto.randomBytes(4).toString('hex')}`;
};

const findFfmpeg = (): string => {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.resolve(process.cwd(), '.codex_tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe'),
    path.resolve(process.cwd(), '..', '.codex_tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe'),
    'ffmpeg',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === 'ffmpeg' || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'ffmpeg';
};

const findFfprobe = (): string => {
  const ffmpeg = findFfmpeg();
  const candidates = [
    process.env.FFPROBE_PATH,
    ffmpeg !== 'ffmpeg' ? path.join(path.dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : undefined,
    path.resolve(process.cwd(), '.codex_tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffprobe.exe'),
    path.resolve(process.cwd(), '..', '.codex_tools/ffmpeg/ffmpeg-8.1.1-essentials_build/bin/ffprobe.exe'),
    'ffprobe',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate === 'ffprobe' || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'ffprobe';
};

const runCommand = (command: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });
};

const mediaDurationSeconds = async (filePath: string): Promise<number> => {
  const output = await runCommand(findFfprobe(), [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Não foi possível ler duração de ${filePath}`);
  }
  return duration;
};

const extractLastFrame = async (videoPath: string, framePath: string): Promise<void> => {
  await runCommand(findFfmpeg(), [
    '-v',
    'error',
    '-y',
    '-sseof',
    '-0.15',
    '-i',
    videoPath,
    '-frames:v',
    '1',
    framePath,
  ]);
};

const assertRunFile = (filePath: string, extension: string): string => {
  const resolved = path.resolve(filePath);
  const root = path.resolve(runsDir());
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Arquivo fora da pasta de runs.');
  }
  if (path.extname(resolved).toLowerCase() !== extension) {
    throw new Error(`Arquivo precisa ter extensão ${extension}.`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Arquivo não encontrado: ${resolved}`);
  }
  return resolved;
};

export const assembleVideos = async (input: AssembleVideosInput) => {
  const take1Path = assertRunFile(input.take1Path, '.mp4');
  const take2Path = assertRunFile(input.take2Path, '.mp4');
  const label = safeLabel(input.label || 'assembled-2takes');
  const id = runId();
  const listName = `${id}-${label}.txt`;
  const outputName = `${id}-${label}.mp4`;
  const outputPath = path.join(runsDir(), outputName);
  const listPath = path.join(runsDir(), listName);

  const ffmpegList = [
    `file '${take1Path.replace(/\\/g, '/')}'`,
    `file '${take2Path.replace(/\\/g, '/')}'`,
  ].join('\n');
  fs.writeFileSync(listPath, ffmpegList, 'utf8');

  try {
    await runCommand(findFfmpeg(), [
      '-v',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  } catch {
    await runCommand(findFfmpeg(), [
      '-v',
      'error',
      '-y',
      '-i',
      take1Path,
      '-i',
      take2Path,
      '-filter_complex',
      '[0:v]scale=480:854:force_original_aspect_ratio=increase,crop=480:854,setsar=1,fps=24,setpts=PTS-STARTPTS[v0];[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];[1:v]scale=480:854:force_original_aspect_ratio=increase,crop=480:854,setsar=1,fps=24,setpts=PTS-STARTPTS[v1];[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '48000',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  } finally {
    fs.rmSync(listPath, { force: true });
  }

  return {
    bytes: fs.statSync(outputPath).size,
    videoUrl: `/openrouter-video-runs/${outputName}`,
    files: {
      outputPath,
      take1Path,
      take2Path,
    },
  };
};

const uploadToCatbox = async (filePath: string): Promise<string> => {
  const curlCandidates = ['curl.exe', 'curl'];
  let lastError: unknown;

  for (const curl of curlCandidates) {
    try {
      const output = await runCommand(curl, [
        '--ssl-no-revoke',
        '-s',
        '-S',
        '-F',
        'reqtype=fileupload',
        '-F',
        `fileToUpload=@${filePath}`,
        'https://catbox.moe/user/api.php',
      ]);

      if (!/^https?:\/\//.test(output)) {
        throw new Error(output || 'Catbox upload failed without a response URL.');
      }

      return output;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Catbox upload failed.');
};

const extensionFromContentType = (contentType: string, fallback: string): string => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('mp4')) return '.mp4';
  if (normalized.includes('m4a')) return '.m4a';
  return fallback;
};

const extensionFromUrl = (url: string, fallback: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext || fallback;
  } catch {
    const ext = path.extname(url).toLowerCase();
    return ext || fallback;
  }
};

const resolveLocalRunUrl = (url: string): string | null => {
  if (!url.startsWith('/openrouter-video-runs/')) return null;
  const filename = path.basename(url.split('?')[0]);
  return path.join(runsDir(), filename);
};

const resolveVideoInput = async (input: GenerateDubbingInput, label: string): Promise<string | null> => {
  const videoPath = String(input.videoPath || '').trim();
  if (videoPath) {
    return assertRunFile(videoPath, '.mp4');
  }

  const videoUrl = String(input.videoUrl || '').trim();
  if (!videoUrl) return null;

  const localRunPath = resolveLocalRunUrl(videoUrl);
  if (localRunPath && fs.existsSync(localRunPath)) {
    return assertRunFile(localRunPath, '.mp4');
  }

  return downloadMediaToRunFile(videoUrl, label, 0);
};

const resolveOptionalMediaInput = async (
  localPath: string | undefined,
  url: string | undefined,
  label: string,
  index: number,
): Promise<string | null> => {
  const rawPath = String(localPath || '').trim();
  if (rawPath) {
    const resolved = path.resolve(rawPath);
    const root = path.resolve(runsDir());
    if (!resolved.startsWith(root + path.sep)) {
      throw new Error('Arquivo de áudio fora da pasta de runs.');
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Arquivo de áudio não encontrado: ${resolved}`);
    }
    return resolved;
  }

  const rawUrl = String(url || '').trim();
  if (!rawUrl) return null;

  const localRunPath = resolveLocalRunUrl(rawUrl);
  if (localRunPath && fs.existsSync(localRunPath)) {
    return localRunPath;
  }

  return downloadMediaToRunFile(rawUrl, label, index);
};

const downloadMediaToRunFile = async (url: string, label: string, index: number): Promise<string> => {
  const localRunPath = resolveLocalRunUrl(url);
  if (localRunPath && fs.existsSync(localRunPath)) {
    return localRunPath;
  }

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: {
      'User-Agent': 'Vertix-WaveSpeed-Media-Bridge/1.0',
    },
  });

  const contentType = String(response.headers['content-type'] || '');
  const fallback = extensionFromUrl(url, '.bin');
  const extension = extensionFromContentType(contentType, fallback);
  const fileName = `${runId()}-${safeLabel(label)}-${String(index + 1).padStart(2, '0')}${extension}`;
  const filePath = path.join(runsDir(), fileName);
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
};

const uploadToWaveSpeed = async (filePath: string): Promise<string> => {
  const output = await runCommand('curl.exe', [
    '--ssl-no-revoke',
    '-s',
    '-S',
    '-H',
    `Authorization: Bearer ${getWaveSpeedApiKey()}`,
    '-F',
    `file=@${filePath}`,
    `${WAVESPEED_BASE_URL}/media/upload/binary`,
  ]);
  const parsed = JSON.parse(output);
  const downloadUrl = parsed?.data?.download_url;
  if (!downloadUrl || !/^https?:\/\//.test(downloadUrl)) {
    throw new Error(`WaveSpeed media upload não retornou download_url: ${output}`);
  }
  return downloadUrl;
};

const prepareWaveSpeedMediaUrls = async (urls: string[], label: string): Promise<string[]> => {
  const prepared: string[] = [];
  for (const [index, url] of urls.entries()) {
    const filePath = await downloadMediaToRunFile(url, label, index);
    prepared.push(await uploadToWaveSpeed(filePath));
  }
  return prepared;
};

export const generateVoiceReferences = async (input: GenerateVoiceReferencesInput) => {
  const clips = (input.clips || []).filter((clip) => clip?.text?.trim());
  if (clips.length === 0) {
    throw new Error('Nenhum texto de voz enviado para a ElevenLabs.');
  }

  const apiKey = getElevenLabsApiKey(input.apiKey);
  const modelId = input.modelId || 'eleven_multilingual_v2';
  const outputFormat = input.outputFormat || 'mp3_44100_128';
  const id = runId();

  const results: Array<{
    character: string;
    label: string;
    voiceId: string;
    modelId: string;
    outputFormat: string;
    bytes: number;
    localUrl: string;
    publicUrl: string | null;
    uploadError: string | null;
    filePath: string;
  }> = [];
  for (const [index, clip] of clips.entries()) {
    const label = safeLabel(clip.label || clip.character || `voice-${index + 1}`);
    const voiceId = voiceIdForClip(clip);
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        text: clip.text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: clip.stability ?? 0.45,
          similarity_boost: clip.similarityBoost ?? 0.75,
          style: clip.style ?? 0.25,
          use_speaker_boost: clip.speakerBoost ?? true,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        params: { output_format: outputFormat },
        responseType: 'arraybuffer',
        timeout: 60_000,
      },
    );

    const fileName = `${id}-${String(index + 1).padStart(2, '0')}-${label}.mp3`;
    const filePath = path.join(runsDir(), fileName);
    fs.writeFileSync(filePath, Buffer.from(response.data));

    let publicUrl: string | null = null;
    let uploadError: string | null = null;
    if (input.upload !== false) {
      try {
        publicUrl = await uploadToCatbox(filePath);
      } catch (error: any) {
        uploadError = error?.message || String(error);
      }
    }

    results.push({
      character: clip.character || clip.label || `voice-${index + 1}`,
      label,
      voiceId,
      modelId,
      outputFormat,
      bytes: fs.statSync(filePath).size,
      localUrl: `/openrouter-video-runs/${fileName}`,
      publicUrl,
      uploadError,
      filePath,
    });
  }

  return {
    results,
    audioReferenceUrls: results.map((item) => item.publicUrl).filter(Boolean),
  };
};

const secondsToTimestamp = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const wholeSeconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(wholeSeconds).padStart(2, '0'),
  ].join(':') + `.${String(millis).padStart(3, '0')}`;
};

const normalizeVoiceLookupKey = (value?: string): string => {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const voiceIdForDubbingLine = (line: DubbingLineInput, input: GenerateDubbingInput): string => {
  if (line.voiceId?.trim()) return line.voiceId.trim();
  const speaker = line.speaker || line.character || line.voiceName || '';
  const lookup = normalizeVoiceLookupKey(speaker);
  const configured = input.voices?.[speaker] || input.voices?.[lookup];
  if (typeof configured === 'string' && configured.trim()) return configured.trim();
  if (configured && typeof configured === 'object' && configured.voiceId?.trim()) return configured.voiceId.trim();
  return voiceIdForClip({
    character: speaker,
    label: speaker,
    text: line.text,
  });
};

const atempoChain = (speed: number): string[] => {
  if (!Number.isFinite(speed) || speed <= 0 || Math.abs(speed - 1) < 0.03) {
    return [];
  }

  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters;
};

const volumeValue = (value: number | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(parsed, 4));
};

const mediaAudioFilter = (duration: number, volume: number): string => {
  return [
    'aresample=48000',
    'asetpts=PTS-STARTPTS',
    `aloop=loop=-1:size=2147483647`,
    `atrim=0:${duration.toFixed(3)}`,
    `volume=${volume.toFixed(3)}`,
  ].join(',');
};

const originalAudioBedFilter = (
  duration: number,
  volume: number,
  removeVocals: boolean,
): string => {
  const filters = ['aresample=48000', 'asetpts=PTS-STARTPTS'];
  if (removeVocals) {
    // Fast karaoke-style removal: cancels centered mono dialogue in a stereo mix.
    // It is intentionally lightweight; neural source separation can replace it later.
    filters.push(
      'pan=stereo|c0=c0-c1|c1=c1-c0',
      'highpass=f=80',
      'lowpass=f=14000',
    );
  }
  filters.push(
    `atrim=0:${duration.toFixed(3)}`,
    `volume=${volume.toFixed(3)}`,
  );
  return filters.join(',');
};

const shouldUseOriginalAudioBed = (input: GenerateDubbingInput): boolean => {
  return Boolean(input.keepOriginalAudioBed || input.removeOriginalVocals);
};

const writeDubbingSubtitles = (
  lines: Array<{ speaker: string; text: string; start: number; end: number }>,
  filePath: string,
) => {
  const body = [
    'WEBVTT',
    '',
    ...lines.flatMap((line) => [
      `${secondsToTimestamp(line.start)} --> ${secondsToTimestamp(line.end)}`,
      `${line.speaker}: ${line.text}`,
      '',
    ]),
  ].join('\n');

  fs.writeFileSync(filePath, body, 'utf8');
};

export const generateDubbing = async (input: GenerateDubbingInput) => {
  const lines = (input.lines || [])
    .map((line, index) => {
      const text = String(line.translatedText || line.text || '').trim();
      const speaker = String(line.speaker || line.character || `speaker-${index + 1}`).trim();
      const start = Number(line.start);
      const end = line.end === undefined || line.end === null ? undefined : Number(line.end);
      if (!text) throw new Error(`Linha ${index + 1} sem texto.`);
      if (!Number.isFinite(start) || start < 0) throw new Error(`Linha ${index + 1} com start inválido.`);
      if (end !== undefined && (!Number.isFinite(end) || end <= start)) {
        throw new Error(`Linha ${index + 1} com end inválido.`);
      }
      return {
        ...line,
        id: line.id || `line-${index + 1}`,
        text,
        speaker,
        start,
        end,
      };
    })
    .sort((a, b) => a.start - b.start);

  if (lines.length === 0) {
    throw new Error('Nenhuma fala enviada para dublagem.');
  }

  const apiKey = getElevenLabsApiKey(input.apiKey);
  const modelId = input.modelId || 'eleven_multilingual_v2';
  const outputFormat = input.outputFormat || 'mp3_44100_128';
  const id = runId();
  const label = safeLabel(input.label || `dubbing-${input.language || 'audio'}`);
  const generatedDir = runsDir();
  const voiceClips: Array<{
    id: string;
    speaker: string;
    text: string;
    start: number;
    end: number;
    targetDuration: number | null;
    originalDuration: number;
    speed: number;
    filePath: string;
    localUrl: string;
  }> = [];

  for (const [index, line] of lines.entries()) {
    const voiceId = voiceIdForDubbingLine(line, input);
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        text: line.text,
        model_id: modelId,
        voice_settings: {
          stability: line.stability ?? 0.45,
          similarity_boost: line.similarityBoost ?? 0.75,
          style: line.style ?? 0.25,
          use_speaker_boost: line.speakerBoost ?? true,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        params: { output_format: outputFormat },
        responseType: 'arraybuffer',
        timeout: 60_000,
      },
    );

    const clipName = `${id}-${String(index + 1).padStart(2, '0')}-${safeLabel(line.speaker)}.mp3`;
    const clipPath = path.join(generatedDir, clipName);
    fs.writeFileSync(clipPath, Buffer.from(response.data));
    const originalDuration = await mediaDurationSeconds(clipPath);
    const targetDuration = line.end !== undefined ? Math.max(0.1, line.end - line.start) : null;
    const speed = targetDuration && input.fitToWindow !== false && originalDuration > targetDuration
      ? originalDuration / targetDuration
      : 1;

    voiceClips.push({
      id: line.id,
      speaker: line.speaker,
      text: line.text,
      start: line.start,
      end: line.end ?? line.start + originalDuration,
      targetDuration,
      originalDuration,
      speed,
      filePath: clipPath,
      localUrl: `/openrouter-video-runs/${clipName}`,
    });
  }

  let videoPath = await resolveVideoInput(input, label);
  const inferredDuration = input.totalDuration
    || (videoPath ? await mediaDurationSeconds(videoPath) : undefined)
    || Math.max(...voiceClips.map((clip) => clip.end + 0.5));
  const totalDuration = Math.max(0.5, Number(inferredDuration));
  const audioName = `${id}-${label}.mp3`;
  const audioPath = path.join(generatedDir, audioName);
  const subtitleName = `${id}-${label}.vtt`;
  const subtitlePath = path.join(generatedDir, subtitleName);

  writeDubbingSubtitles(
    voiceClips.map((clip) => ({
      speaker: clip.speaker,
      text: clip.text,
      start: clip.start,
      end: clip.targetDuration ? clip.start + clip.targetDuration : clip.end,
    })),
    subtitlePath,
  );

  const musicPath = await resolveOptionalMediaInput(input.musicPath, input.musicUrl, `${label}-music`, voiceClips.length + 1);
  const ambiencePath = await resolveOptionalMediaInput(input.ambiencePath, input.ambienceUrl, `${label}-ambience`, voiceClips.length + 2);
  const sfxInputs = [
    ...(input.sfxPaths || []).map((item) => ({ path: item, url: undefined })),
    ...(input.sfxUrls || []).map((item) => ({ path: undefined, url: item })),
  ];
  const sfxPaths = (
    await Promise.all(
      sfxInputs.map((item, index) => resolveOptionalMediaInput(item.path, item.url, `${label}-sfx`, voiceClips.length + 3 + index)),
    )
  ).filter(Boolean) as string[];

  const inputPaths = voiceClips.map((clip) => clip.filePath);
  const dialogueVolume = volumeValue(input.dialogueVolume, 1);
  const bedSpecs: Array<{ path: string; label: string; filter: string }> = [];
  if (shouldUseOriginalAudioBed(input) && videoPath) {
    bedSpecs.push({
      path: videoPath,
      label: 'origbed',
      filter: originalAudioBedFilter(
        totalDuration,
        volumeValue(input.originalAudioVolume, input.removeOriginalVocals ? 0.45 : 0.18),
        Boolean(input.removeOriginalVocals && input.originalVocalRemovalMode !== 'none'),
      ),
    });
  }
  if (musicPath) {
    bedSpecs.push({
      path: musicPath,
      label: 'music',
      filter: mediaAudioFilter(totalDuration, volumeValue(input.musicVolume, 0.28)),
    });
  }
  if (ambiencePath) {
    bedSpecs.push({
      path: ambiencePath,
      label: 'ambience',
      filter: mediaAudioFilter(totalDuration, volumeValue(input.ambienceVolume, 0.35)),
    });
  }
  sfxPaths.forEach((sfxPath, index) => {
    bedSpecs.push({
      path: sfxPath,
      label: `sfx${index}`,
      filter: mediaAudioFilter(totalDuration, volumeValue(input.sfxVolume, 0.5)),
    });
  });
  inputPaths.push(...bedSpecs.map((spec) => spec.path));

  const filterParts: string[] = [];
  const labels: string[] = [];
  for (const [index, clip] of voiceClips.entries()) {
    const filters = [
      'aresample=48000',
      'asetpts=PTS-STARTPTS',
      ...atempoChain(clip.speed),
    ];
    if (clip.targetDuration) {
      filters.push(`atrim=0:${clip.targetDuration.toFixed(3)}`, 'asetpts=PTS-STARTPTS');
    }
    filters.push(
      `volume=${dialogueVolume.toFixed(3)}`,
      `adelay=${Math.round(clip.start * 1000)}|${Math.round(clip.start * 1000)}`,
    );
    filterParts.push(`[${index}:a]${filters.join(',')}[a${index}]`);
    labels.push(`[a${index}]`);
  }

  bedSpecs.forEach((spec, index) => {
    const inputIndex = voiceClips.length + index;
    filterParts.push(`[${inputIndex}:a]${spec.filter}[${spec.label}]`);
    labels.push(`[${spec.label}]`);
  });

  filterParts.push(
    `${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,apad,atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS[aout]`,
  );

  await runCommand(findFfmpeg(), [
    '-v',
    'error',
    '-y',
    ...inputPaths.flatMap((inputPath) => ['-i', inputPath]),
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[aout]',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    audioPath,
  ]);

  let dubbedVideoPath: string | null = null;
  let dubbedVideoUrl: string | null = null;
  if (input.outputVideo !== false && videoPath) {
    const videoName = `${id}-${label}-dubbed.mp4`;
    dubbedVideoPath = path.join(generatedDir, videoName);
    await runCommand(findFfmpeg(), [
      '-v',
      'error',
      '-y',
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-shortest',
      '-movflags',
      '+faststart',
      dubbedVideoPath,
    ]);
    dubbedVideoUrl = `/openrouter-video-runs/${videoName}`;
  }

  let publicAudioUrl: string | null = null;
  let publicVideoUrl: string | null = null;
  let publicSubtitleUrl: string | null = null;
  const uploadErrors: string[] = [];
  if (input.upload) {
    try {
      publicAudioUrl = await uploadToCatbox(audioPath);
    } catch (error: any) {
      uploadErrors.push(`audio: ${error?.message || String(error)}`);
    }
    if (dubbedVideoPath) {
      try {
        publicVideoUrl = await uploadToCatbox(dubbedVideoPath);
      } catch (error: any) {
        uploadErrors.push(`video: ${error?.message || String(error)}`);
      }
    }
    try {
      publicSubtitleUrl = await uploadToCatbox(subtitlePath);
    } catch (error: any) {
      uploadErrors.push(`subtitles: ${error?.message || String(error)}`);
    }
  }

  return {
    language: input.language || 'und',
    label,
    lineCount: voiceClips.length,
    totalDuration,
    modelId,
    fitToWindow: input.fitToWindow !== false,
    originalAudioBed: shouldUseOriginalAudioBed(input)
      ? {
          enabled: true,
          removeOriginalVocals: Boolean(input.removeOriginalVocals && input.originalVocalRemovalMode !== 'none'),
          mode: input.removeOriginalVocals ? (input.originalVocalRemovalMode || 'center_cancel') : 'none',
          volume: volumeValue(input.originalAudioVolume, input.removeOriginalVocals ? 0.45 : 0.18),
        }
      : { enabled: false },
    audioUrl: `/openrouter-video-runs/${audioName}`,
    subtitleUrl: `/openrouter-video-runs/${subtitleName}`,
    dubbedVideoUrl,
    publicAudioUrl,
    publicVideoUrl,
    publicSubtitleUrl,
    uploadErrors,
    clips: voiceClips.map((clip) => ({
      id: clip.id,
      speaker: clip.speaker,
      text: clip.text,
      start: clip.start,
      end: clip.end,
      targetDuration: clip.targetDuration,
      originalDuration: Number(clip.originalDuration.toFixed(3)),
      speed: Number(clip.speed.toFixed(3)),
      localUrl: clip.localUrl,
    })),
    files: {
      audioPath,
      subtitlePath,
      dubbedVideoPath,
      sourceVideoPath: videoPath,
      clipPaths: voiceClips.map((clip) => clip.filePath),
      musicPath,
      ambiencePath,
      sfxPaths,
    },
  };
};

const saveGeneratedVideo = async (
  buffer: Buffer,
  input: {
    provider: VideoProvider;
    jobId?: string;
    label?: string;
    uploadLastFrame?: boolean;
  },
) => {
  const label = safeLabel(input.label);
  const id = runId();
  const videoName = `${id}-${label}.mp4`;
  const frameName = `${id}-${label}-last-frame.png`;
  const videoPath = path.join(runsDir(), videoName);
  const framePath = path.join(runsDir(), frameName);

  fs.writeFileSync(videoPath, buffer);
  await extractLastFrame(videoPath, framePath);

  let publicLastFrameUrl: string | null = null;
  let uploadError: string | null = null;

  if (input.uploadLastFrame !== false) {
    try {
      publicLastFrameUrl = await uploadToCatbox(framePath);
    } catch (error: any) {
      uploadError = error?.message || String(error);
    }
  }

  return {
    provider: input.provider,
    jobId: input.jobId || `${input.provider}-${id}`,
    bytes: fs.statSync(videoPath).size,
    videoUrl: `/openrouter-video-runs/${videoName}`,
    lastFrameUrl: `/openrouter-video-runs/${frameName}`,
    publicLastFrameUrl,
    uploadError,
    files: {
      videoPath,
      framePath,
    },
  };
};

const mediaMode = (firstFrameUrl: string, referencesCount: number): string => {
  if (firstFrameUrl && referencesCount > 0) return 'first_frame_with_references';
  if (firstFrameUrl) return 'first_frame';
  return 'references';
};

const submitOpenRouterVideoJob = async (input: SubmitVideoJobInput) => {
  if (!input.prompt || !input.prompt.trim()) {
    throw new Error('Prompt vazio.');
  }

  const payload: any = {
    model: input.model || DEFAULT_MODEL,
    prompt: input.prompt,
    duration: Number(input.duration || 15),
    resolution: input.resolution || '480p',
    aspect_ratio: input.aspectRatio || '9:16',
    generate_audio: input.generateAudio !== false,
  };

  if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
    payload.seed = input.seed;
  }

  const firstFrameUrl = String(input.firstFrameUrl || '').trim();
  const references = imageParts(input.inputReferenceUrls);
  const audioReferences = audioReferenceUrls(input.referenceAudioUrls);

  if (firstFrameUrl) {
    const firstFrame: FrameImagePart = {
      type: 'image_url',
      image_url: { url: firstFrameUrl },
      frame_type: 'first_frame',
    };
    payload.frame_images = [firstFrame];
  }

  if (references.length > 0) {
    payload.input_references = references;
  }

  const response = await axios.post(`${OPENROUTER_VIDEO_BASE_URL}/videos`, payload, {
    headers: openRouterHeaders(input.apiKey),
    timeout: 60_000,
  });

  return {
    provider: 'openrouter',
    openrouter: response.data,
    payload: {
      ...payload,
      prompt: payload.prompt,
    },
    mode: mediaMode(firstFrameUrl, references.length),
    audioReferencesNotSent: audioReferences.length,
  };
};

const submitSegmindVideoJob = async (input: SubmitVideoJobInput) => {
  if (!input.prompt || !input.prompt.trim()) {
    throw new Error('Prompt vazio.');
  }

  const firstFrameUrl = String(input.firstFrameUrl || '').trim();
  const references = firstFrameUrl ? [] : cleanUrls(input.inputReferenceUrls);
  const audioReferences = audioReferenceUrls(input.referenceAudioUrls);
  const payload: any = {
    prompt: input.prompt,
    duration: Number(input.duration || 15),
    resolution: input.resolution || '480p',
    aspect_ratio: input.aspectRatio || '9:16',
    generate_audio: input.generateAudio !== false,
    return_last_frame: true,
  };

  if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
    payload.seed = input.seed;
  }

  if (firstFrameUrl) {
    payload.first_frame_url = firstFrameUrl;
  }

  if (references.length > 0) {
    payload.reference_images = references;
  }

  if (audioReferences.length > 0) {
    payload.reference_audios = audioReferences;
  }

  const response = await axios.post(SEGMIND_SEEDANCE_ENDPOINT, payload, {
    headers: segmindHeaders(),
    responseType: 'arraybuffer',
    timeout: 15 * 60_000,
  });

  const contentType = String(response.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    const body = Buffer.from(response.data).toString('utf8');
    throw new Error(`Segmind retornou JSON em vez de vídeo: ${body}`);
  }

  const result = await saveGeneratedVideo(Buffer.from(response.data), {
    provider: 'segmind',
    label: input.label || (input.firstFrameUrl ? 'take2-segmind' : 'take-segmind'),
    uploadLastFrame: input.uploadLastFrame,
  });

  return {
    provider: 'segmind',
    completed: true,
    jobId: result.jobId,
    result,
    payload,
    mode: mediaMode(firstFrameUrl, references.length),
    skippedReferences: firstFrameUrl ? cleanUrls(input.inputReferenceUrls).length : 0,
  };
};

const submitWaveSpeedVideoJob = async (input: SubmitVideoJobInput) => {
  if (!input.prompt || !input.prompt.trim()) {
    throw new Error('Prompt vazio.');
  }

  const firstFrameUrl = String(input.firstFrameUrl || '').trim();
  const rawReferences = cleanUrls(input.inputReferenceUrls).slice(0, 4);
  const rawAudioReferences = audioReferenceUrls(input.referenceAudioUrls);
  const [references, audioReferences, preparedFirstFrame] = await Promise.all([
    prepareWaveSpeedMediaUrls(rawReferences, 'wavespeed-reference'),
    prepareWaveSpeedMediaUrls(rawAudioReferences, 'wavespeed-audio-reference'),
    firstFrameUrl
      ? prepareWaveSpeedMediaUrls([firstFrameUrl], 'wavespeed-first-frame').then((urls) => urls[0])
      : Promise.resolve(''),
  ]);
  const endpoint = firstFrameUrl
    ? `${WAVESPEED_BASE_URL}/bytedance/seedance-2.0/image-to-video`
    : `${WAVESPEED_BASE_URL}/bytedance/seedance-2.0/text-to-video`;
  const payload: any = {
    prompt: input.prompt,
    duration: Number(input.duration || 15),
    resolution: input.resolution || '480p',
    aspect_ratio: input.aspectRatio || '9:16',
    enable_web_search: false,
    generate_audio: input.generateAudio !== false,
  };

  if (firstFrameUrl) {
    payload.image = preparedFirstFrame;
  }

  if (references.length > 0) {
    payload.reference_images = references;
  }

  if (audioReferences.length > 0) {
    payload.reference_audios = audioReferences;
  }

  const response = await axios.post(endpoint, payload, {
    headers: waveSpeedHeaders(),
    timeout: 60_000,
  });
  const jobId = response.data?.data?.id || response.data?.id;
  if (!jobId) {
    const error = new Error('WaveSpeed não retornou id do job. Veja os detalhes brutos no log.');
    (error as any).responseBody = response.data;
    throw error;
  }

  return {
    provider: 'wavespeed',
    jobId,
    wavespeed: response.data,
    payload,
    mode: mediaMode(firstFrameUrl, references.length),
    mediaBridge: {
      inputReferences: rawReferences.length,
      audioReferences: rawAudioReferences.length,
      firstFrame: Boolean(firstFrameUrl),
    },
  };
};

export const submitVideoJob = async (input: SubmitVideoJobInput) => {
  const provider = videoProvider(input.provider);
  if (provider === 'segmind') return submitSegmindVideoJob(input);
  if (provider === 'wavespeed') return submitWaveSpeedVideoJob(input);
  return submitOpenRouterVideoJob(input);
};

export const getVideoJobStatus = async (input: { apiKey?: string; provider?: string }, jobId: string) => {
  if (videoProvider(input.provider) === 'wavespeed') {
    const response = await axios.get(`${WAVESPEED_BASE_URL}/predictions/${encodeURIComponent(jobId)}/result`, {
      headers: waveSpeedHeaders(),
      timeout: 60_000,
    });

    return response.data;
  }

  const response = await axios.get(`${OPENROUTER_VIDEO_BASE_URL}/videos/${encodeURIComponent(jobId)}`, {
    headers: openRouterHeaders(input.apiKey),
    timeout: 60_000,
  });

  return response.data;
};

export const getVideoModels = async (apiKey?: string) => {
  const response = await axios.get(`${OPENROUTER_VIDEO_BASE_URL}/videos/models`, {
    headers: openRouterHeaders(apiKey),
    timeout: 60_000,
  });

  return response.data;
};

export const downloadVideoJob = async (input: DownloadJobInput) => {
  const index = Number.isFinite(input.index) ? Number(input.index) : 0;
  const jobId = String(input.jobId || '').trim();
  if (!jobId) {
    throw new Error('jobId vazio.');
  }

  const label = safeLabel(input.label);
  if (videoProvider(input.provider) === 'wavespeed') {
    const status = await getVideoJobStatus({ provider: 'wavespeed' }, jobId);
    const outputs = status?.data?.outputs || status?.outputs || [];
    const videoUrl = Array.isArray(outputs) ? outputs[index] : outputs?.[index];
    if (!videoUrl) {
      const error = new Error('WaveSpeed ainda não retornou URL de vídeo para download.');
      (error as any).responseBody = status;
      throw error;
    }
    const response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 10 * 60_000,
    });

    return saveGeneratedVideo(Buffer.from(response.data), {
      provider: 'wavespeed',
      jobId,
      label,
      uploadLastFrame: input.uploadLastFrame,
    });
  }

  const response = await axios.get(
    `${OPENROUTER_VIDEO_BASE_URL}/videos/${encodeURIComponent(jobId)}/content?index=${index}`,
    {
      headers: openRouterHeaders(input.apiKey),
      responseType: 'arraybuffer',
      timeout: 10 * 60_000,
    },
  );

  return saveGeneratedVideo(Buffer.from(response.data), {
    provider: 'openrouter',
    jobId,
    label,
    uploadLastFrame: input.uploadLastFrame,
  });
};

export default {
  submitVideoJob,
  getVideoJobStatus,
  getVideoModels,
  downloadVideoJob,
  assembleVideos,
  generateVoiceReferences,
  generateDubbing,
};
