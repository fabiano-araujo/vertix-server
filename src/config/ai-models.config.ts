import { AVAILABLE_MODELS } from '../services/openrouter.service';

export const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash-0731';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

export const RECOMMENDED_OPENROUTER_MODELS = [
  {
    id: DEFAULT_OPENROUTER_MODEL,
    name: 'DeepSeek V4 Flash',
    description: 'Padrão do Vertix para esboço, fichas, roteiro e takes',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'Alternativa DeepSeek mais conversacional',
  },
  {
    id: AVAILABLE_MODELS.GPT_4O_MINI,
    name: 'GPT-4o mini',
    description: 'Rápido e barato via OpenRouter',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Boa qualidade com contexto longo',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Roteiro mais literário',
  },
  {
    id: AVAILABLE_MODELS.GEMMA_3_27B_IT,
    name: 'Gemma 3 27B',
    description: 'Fallback aberto',
  },
] as const;

export const MODEL_ALIASES = {
  chat: DEFAULT_OPENROUTER_MODEL,
  file: AVAILABLE_MODELS.GEMMA_3_12B_IT,
  summary_en: AVAILABLE_MODELS.GEMMA_3_12B_IT,
  code: AVAILABLE_MODELS.MISTRAL_SMALL_3_1_24B,
  bom: DEFAULT_OPENROUTER_MODEL,
};

const looksLikeOpenRouterModel = (value: string): boolean =>
  /^[a-z0-9._-]+\/[a-z0-9._:+-]+$/i.test(value.trim());

const stripOpenRouterRouting = (value: string): string =>
  value.replace(/:(nitro|floor|exacto)\b/gi, '').trim();

export const resolveModel = (modelName?: string | null): string => {
  if (!modelName || !modelName.trim()) {
    return DEFAULT_OPENROUTER_MODEL;
  }

  const trimmed = stripOpenRouterRouting(modelName.trim());
  if (trimmed in MODEL_ALIASES) {
    return MODEL_ALIASES[trimmed as keyof typeof MODEL_ALIASES];
  }

  const known = Object.values(AVAILABLE_MODELS);
  if (known.includes(trimmed as (typeof known)[number])) {
    return trimmed;
  }

  if (looksLikeOpenRouterModel(trimmed) || trimmed.startsWith('gpt-image')) {
    return trimmed;
  }

  console.warn(`Modelo "${trimmed}" não reconhecido, usando o padrão Vertix`);
  return DEFAULT_OPENROUTER_MODEL;
};

export const suggestModelByContent = (prompt: string): string => {
  const promptLower = prompt.toLowerCase();

  if (
    (promptLower.includes('resume') || promptLower.includes('summary')) &&
    (promptLower.includes('english') || promptLower.includes('inglês'))
  ) {
    return MODEL_ALIASES.summary_en;
  }

  if (
    promptLower.includes('arquivo') ||
    promptLower.includes('documento') ||
    promptLower.includes('file') ||
    promptLower.includes('document')
  ) {
    return MODEL_ALIASES.file;
  }

  if (
    promptLower.includes('código') ||
    promptLower.includes('code') ||
    promptLower.includes('programação') ||
    promptLower.includes('programming')
  ) {
    return MODEL_ALIASES.code;
  }

  return MODEL_ALIASES.chat;
};

export default {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_IMAGE_MODEL,
  RECOMMENDED_OPENROUTER_MODELS,
  MODEL_ALIASES,
  resolveModel,
  suggestModelByContent,
};
