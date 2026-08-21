import axios from 'axios';
import dotenv from 'dotenv';
import { Readable } from 'stream';

// Carrega as variáveis de ambiente
dotenv.config();

// Configuração da API OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const SITE_NAME = process.env.SITE_NAME || 'Projeto Base';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Modelos disponíveis
export const AVAILABLE_MODELS = {
  DEEPSEEK_V4_FLASH: 'deepseek/deepseek-v4-flash-0731',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  GPT_OSS_20B: 'openai/gpt-oss-20b',
  GEMMA_3_12B_IT: 'google/gemma-3-12b-it',
  GEMMA_3_4B_IT: 'google/gemma-3-4b-it',
  GEMMA_3_27B_IT: 'google/gemma-3-27b-it',
  CLAUDE_3_OPUS: 'anthropic/claude-3-opus:beta',
  CLAUDE_3_SONNET: 'anthropic/claude-3-sonnet',
  CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku',
  MISTRAL_SMALL_3_1_24B: 'mistralai/mistral-small-3.1-24b-instruct',
};

export type OpenRouterReasoning = {
  effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  max_tokens?: number;
  exclude?: boolean;
};

/** OpenRouter rejects payloads that set both `reasoning.effort` and `reasoning.max_tokens`. */
export const sanitizeOpenRouterReasoning = (
  reasoning?: OpenRouterReasoning | null,
): OpenRouterReasoning | undefined => {
  if (!reasoning) return undefined;
  const { effort, max_tokens, exclude } = reasoning;
  if (effort) {
    return exclude === undefined ? { effort } : { effort, exclude };
  }
  if (typeof max_tokens === 'number') {
    return exclude === undefined ? { max_tokens } : { max_tokens, exclude };
  }
  if (exclude !== undefined) {
    return { exclude };
  }
  return undefined;
};

const EMPTY_LENGTH_RETRY_MAX_TOKENS = 16384;
const STORY_MIN_COMPLETION_TOKENS = 8192;
const STORY_RETRY_REASONING_TOKENS = 2048;

/** Fast JSON answers: no high-effort chain-of-thought that burns minutes and wrecks json_object. */
export const STORY_REASONING_HIDDEN: OpenRouterReasoning = {
  effort: 'none',
};

/** Light visible thought for the studio, without the high-effort stall. */
export const STORY_REASONING_VISIBLE: OpenRouterReasoning = {
  effort: 'low',
  exclude: false,
};

export type OpenRouterTextMeta = {
  content: string;
  reasoning: string;
  reasoningTokens: number;
  promptTokens: number;
  completionTokens: number;
  finishReason: string;
  model: string;
};

const reasoningPiecesFrom = (source: any): string[] => {
  if (!source || typeof source !== 'object') return [];
  const pieces: string[] = [];
  if (typeof source.reasoning === 'string') pieces.push(source.reasoning);
  if (typeof source.reasoning_content === 'string') pieces.push(source.reasoning_content);
  const details = source.reasoning_details;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (typeof item?.text === 'string') pieces.push(item.text);
      else if (typeof item?.content === 'string') pieces.push(item.content);
    }
  }
  return pieces.filter((piece) => piece.trim());
};

const extractOpenRouterReasoning = (message: any): string =>
  reasoningPiecesFrom(message).join('\n\n').trim();

export type OpenRouterStreamAccumulation = {
  content: string;
  reasoning: string;
  finishReason: string;
  model: string;
  reasoningTokens: number;
  promptTokens: number;
  completionTokens: number;
};

export const createOpenRouterStreamAccumulation = (): OpenRouterStreamAccumulation => ({
  content: '',
  reasoning: '',
  finishReason: '',
  model: '',
  reasoningTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
});

/** Apply one OpenRouter SSE JSON payload. Returns true when visible thought grew. */
export const ingestOpenRouterStreamChunk = (
  state: OpenRouterStreamAccumulation,
  parsed: any,
): boolean => {
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.error) {
    const message = parsed.error.message || parsed.error || 'Erro no stream de dados';
    throw new Error(typeof message === 'string' ? message : 'Erro no stream de dados');
  }
  if (typeof parsed.model === 'string' && parsed.model.trim()) {
    state.model = parsed.model.trim();
  }
  const usage = parsed.usage;
  if (usage && typeof usage === 'object') {
    state.promptTokens = Number(usage.prompt_tokens || state.promptTokens);
    state.completionTokens = Number(usage.completion_tokens || state.completionTokens);
    state.reasoningTokens = Number(
      usage.completion_tokens_details?.reasoning_tokens || state.reasoningTokens,
    );
  }
  const choice = parsed.choices?.[0];
  if (!choice || typeof choice !== 'object') return false;
  if (choice.finish_reason) {
    state.finishReason = String(choice.finish_reason);
  }
  const before = state.reasoning;
  const delta = choice.delta;
  const deltaReasoning = reasoningPiecesFrom(delta).join('');
  if (deltaReasoning) {
    state.reasoning += deltaReasoning;
  }
  const messageReasoning = extractOpenRouterReasoning(choice.message);
  if (messageReasoning && messageReasoning.length >= state.reasoning.length) {
    state.reasoning = messageReasoning;
  }
  const deltaContent = typeof delta?.content === 'string' ? delta.content : '';
  if (deltaContent) {
    state.content += deltaContent;
  } else if (!delta && typeof choice.message?.content === 'string') {
    state.content = choice.message.content;
  }
  return state.reasoning !== before;
};

export const ingestOpenRouterSseLine = (
  state: OpenRouterStreamAccumulation,
  line: string,
): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return false;
  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') return false;
  try {
    return ingestOpenRouterStreamChunk(state, JSON.parse(data));
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};

export const storyCompletionBudget = (maxTokens: number): number =>
  Math.max(STORY_MIN_COMPLETION_TOKENS, Math.trunc(maxTokens || 0));

export const nextOpenRouterLengthRetry = (
  currentMaxTokens: number | undefined,
  finishReason: string | undefined,
  content: string,
  alreadyRetried: boolean,
): { max_tokens: number; reasoning: OpenRouterReasoning } | null => {
  if (alreadyRetried || String(content || '').trim()) return null;
  const finish = String(finishReason || '').toLowerCase();
  const hitLength = finish === 'length' || finish === 'max_tokens' || !finish;
  if (!hitLength && finish !== 'stop') return null;
  const current = Math.max(0, Math.trunc(currentMaxTokens || 0));
  return {
    max_tokens: Math.min(
      EMPTY_LENGTH_RETRY_MAX_TOKENS,
      Math.max(current * 2, STORY_MIN_COMPLETION_TOKENS),
    ),
    reasoning: { max_tokens: STORY_RETRY_REASONING_TOKENS, exclude: true },
  };
};

export const openRouterErrorMessage = (error: unknown): string => {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  const data = response?.data;
  const nested =
    data && typeof data === 'object'
      ? (data as { error?: { message?: unknown } | string; message?: unknown }).error
      : undefined;
  const detail = typeof nested === 'string'
    ? nested
    : nested && typeof nested === 'object' && nested.message != null
      ? String(nested.message)
      : data && typeof data === 'object' && (data as { message?: unknown }).message != null
        ? String((data as { message?: unknown }).message)
        : '';
  const status = response?.status;
  if (detail && status) {
    return `OpenRouter ${status}: ${detail}`;
  }
  if (detail) return detail;
  const fallback = (error as { message?: string })?.message;
  return fallback || 'Falha no OpenRouter';
};

// Sufixos :nitro/:floor/:exacto saem do model id; o roteamento vai no objeto `provider`.
const OPENROUTER_ROUTING_SUFFIX = /:(nitro|floor|exacto)\b/gi;

const toDefaultProviderModel = (model: string): string =>
  model.replace(OPENROUTER_ROUTING_SUFFIX, '').trim();

/** Teto padrão: US$ 0,30 por milhão de tokens de saída (completion). */
export const OPENROUTER_MAX_COMPLETION_USD_PER_MILLION = 0.30;

export type OpenRouterProviderSort = 'throughput' | 'latency' | 'price';

export type OpenRouterProviderPreferences = {
  order: string[];
  allow_fallbacks: boolean;
  sort: OpenRouterProviderSort;
  max_price: {
    completion: number;
  };
};

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseProviderSort = (value: string | undefined): OpenRouterProviderSort => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'latency' || normalized === 'price' || normalized === 'throughput') {
    return normalized;
  }
  return 'throughput';
};

const parseProviderOrder = (value: string | undefined): string[] => {
  const fromEnv = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : ['DeepSeek'];
};

/**
 * Prefere DeepSeek (rápido). AtlasCloud/Wafer caros ficam de fora pelo teto de US$ 0,30/M.
 */
export const openRouterProviderPreferences = (): OpenRouterProviderPreferences => ({
  order: parseProviderOrder(process.env.OPENROUTER_PROVIDER_ORDER),
  allow_fallbacks: process.env.OPENROUTER_ALLOW_FALLBACKS === '0' ? false : true,
  sort: parseProviderSort(process.env.OPENROUTER_PROVIDER_SORT),
  max_price: {
    completion: parsePositiveNumber(
      process.env.OPENROUTER_MAX_OUTPUT_PRICE,
      OPENROUTER_MAX_COMPLETION_USD_PER_MILLION,
    ),
  },
});

// Tipos para as mensagens
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageUrlContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

// Novo tipo para imagens em base64
interface ImageBase64Content {
  type: 'image_url';
  image_url: {
    url: string; // URL com formato data:image/...;base64,...
  };
}

// Tipo para representar a fonte da imagem (URL ou base64)
type ImageSource = { type: 'url', data: string } | { type: 'base64', data: string };

type MessageContent = TextContent | ImageUrlContent | ImageBase64Content;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent | MessageContent[];
}

interface OpenRouterRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Função auxiliar para imprimir erros detalhados
const logDetailedError = (error: any) => {
  console.error('Erro detalhado:');
  if (error.response) {
    // O servidor respondeu com um status de erro
    console.error('Status de erro:', error.response.status);
    console.error('Cabeçalhos:', JSON.stringify(error.response.headers, null, 2));
    console.error('Dados:', error.response.data);
  } else if (error.request) {
    // A requisição foi feita mas não houve resposta
    console.error('Sem resposta. Requisição:', error.request);
  } else {
    // Algo aconteceu na configuração da requisição
    console.error('Erro de configuração:', error.message);
  }
  console.error('Configuração:', JSON.stringify({
    ...error.config,
    headers: {
      ...error.config?.headers,
      Authorization: error.config?.headers?.Authorization ? '[REDACTED]' : undefined
    }
  }, null, 2));
};

/**
 * Função para analisar imagens usando modelos via OpenRouter
 * @param imageSource Fonte da imagem (URL ou base64)
 * @param prompt Texto opcional para guiar a análise da imagem
 * @param model Nome do modelo a ser usado (padrão: Claude-3-Opus)
 * @param streaming Se deve usar streaming (padrão: false)
 * @param abortController Controlador para abortar a requisição (opcional)
 * @returns Promise com o resultado da análise ou um stream
 */
export const analyzeImage = async (
  imageSource: ImageSource, 
  prompt: string = 'O que está nesta imagem?',
  model: string = AVAILABLE_MODELS.CLAUDE_3_OPUS,
  streaming: boolean = false,
  abortController?: AbortController
): Promise<string | Readable> => {
  try {
    // Prepara a URL da imagem com base no tipo de fonte
    let imageUrl: string;
    
    if (imageSource.type === 'url') {
      // Se for URL direta, usa como está
      imageUrl = imageSource.data;
    } else {
      // Se for base64, verifica se já tem o prefixo data:image
      if (imageSource.data.startsWith('data:image')) {
        imageUrl = imageSource.data; // Já está no formato correto
      } else {
        // Adiciona o prefixo para imagens base64 sem o prefixo
        imageUrl = `data:image/jpeg;base64,${imageSource.data}`;
      }
    }

    // Versão simplificada da mensagem para compatibilidade
    const request = {
      model: toDefaultProviderModel(model),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      stream: streaming,
      provider: openRouterProviderPreferences(),
    };

    console.log(`Enviando requisição para analisar imagem com o modelo ${model} (streaming: ${streaming}):`, JSON.stringify(request, null, 2));

    // Configuração básica para a requisição
    const config = {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Referer': SITE_URL,
        'X-Title': SITE_NAME,
        'Content-Type': 'application/json'
      },
      signal: abortController ? abortController.signal : undefined
    };

    if (streaming) {
      const response = await axios.post(API_URL, request, {
        ...config,
        headers: {
          ...config.headers,
          'Accept': 'text/event-stream'
        },
        responseType: 'stream'
      });

      return response.data;
    } else {
      const response = await axios.post<OpenRouterResponse>(API_URL, request, config);

      console.log('Resposta recebida:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      }
      
      throw new Error('Resposta vazia do OpenRouter');
    }
  } catch (error: any) {
    // Verifica se o erro foi causado por um abort manual
    if (
      error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED' ||
      error.message === 'canceled'
    ) {
      console.log('Requisição cancelada pelo usuário');
      throw new Error('Requisição cancelada pelo usuário');
    }
    
    logDetailedError(error);
    throw error;
  }
};

const REASONING_STREAM_EMIT_MS = 400;

const consumeOpenRouterSseStream = (
  stream: Readable,
  onReasoning?: (thought: string) => void,
  abortController?: AbortController,
): Promise<OpenRouterStreamAccumulation> =>
  new Promise((resolve, reject) => {
    const state = createOpenRouterStreamAccumulation();
    let buffer = '';
    let lastEmitAt = 0;
    let settled = false;
    const emitReasoning = (force = false) => {
      if (!onReasoning || !state.reasoning) return;
      const now = Date.now();
      if (!force && now - lastEmitAt < REASONING_STREAM_EMIT_MS) return;
      lastEmitAt = now;
      onReasoning(state.reasoning);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      abortController?.signal.removeEventListener('abort', onAbort);
      if (error) {
        reject(error);
        return;
      }
      emitReasoning(true);
      resolve(state);
    };
    const onAbort = () => {
      stream.destroy();
      finish(new Error('Requisição cancelada pelo usuário'));
    };
    abortController?.signal.addEventListener('abort', onAbort, { once: true });
    if (abortController?.signal.aborted) {
      onAbort();
      return;
    }

    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        try {
          if (ingestOpenRouterSseLine(state, line)) {
            emitReasoning();
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
          stream.destroy();
          return;
        }
      }
    });
    stream.on('end', () => finish());
    stream.on('error', (err) => {
      finish(err instanceof Error ? err : new Error(String(err)));
    });
  });

/**
 * Text generation with reasoning/token metadata. Streams by default so the
 * studio can show the model thought before the JSON answer arrives.
 */
export const generateTextWithMeta = async (
  prompt: string | Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    timeout?: number;
    reasoning?: OpenRouterReasoning;
    response_format?: { type: 'json_object' | 'text' };
    lengthRetry?: boolean;
    stream?: boolean;
    onReasoning?: (thought: string) => void;
  } = {},
  abortController?: AbortController,
): Promise<OpenRouterTextMeta> => {
  if (!OPENROUTER_API_KEY.trim()) {
    throw new Error('OPENROUTER_API_KEY nao configurada no servidor');
  }

  let messages: Array<{ role: string; content: string }>;
  if (Array.isArray(prompt)) {
    messages = prompt;
  } else {
    messages = [{ role: 'user', content: prompt }];
  }

  const provider = openRouterProviderPreferences();
  const useStream = options.stream !== false;
  const request: Record<string, unknown> = {
    model: toDefaultProviderModel(options.model || AVAILABLE_MODELS.DEEPSEEK_V4_FLASH),
    messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    stream: useStream,
    provider,
  };
  if (useStream) {
    request.stream_options = { include_usage: true };
  }
  if (options.response_format) {
    request.response_format = options.response_format;
  }
  const reasoning = sanitizeOpenRouterReasoning(options.reasoning);
  if (reasoning) {
    request.reasoning = reasoning;
  }

  console.log(
    `Enviando texto para OpenRouter model=${request.model} streaming=${useStream} max_tokens=${options.max_tokens || 'default'} provider_order=${provider.order.join(',')} sort=${provider.sort} max_output=$${provider.max_price.completion}/M`,
  );

  const config = {
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      Referer: SITE_URL,
      'X-Title': SITE_NAME,
      'Content-Type': 'application/json',
    },
    signal: abortController ? abortController.signal : undefined,
    timeout: options.timeout || 180000,
  };

  const metaFromAccumulation = (
    state: OpenRouterStreamAccumulation,
  ): OpenRouterTextMeta => ({
    content: state.content,
    reasoning: state.reasoning.trim(),
    reasoningTokens: state.reasoningTokens,
    promptTokens: state.promptTokens,
    completionTokens: state.completionTokens,
    finishReason: state.finishReason || 'unknown',
    model: state.model || String(request.model || ''),
  });

  const runOnce = async (): Promise<OpenRouterTextMeta> => {
    if (!useStream) {
      const response = await axios.post<OpenRouterResponse>(API_URL, request, config);
      const choice = response.data?.choices?.[0] as any;
      const content = typeof choice?.message?.content === 'string'
        ? choice.message.content
        : '';
      const usage = response.data?.usage as any;
      const routedProvider = (response.data as { provider?: unknown } | undefined)?.provider;
      const meta: OpenRouterTextMeta = {
        content,
        reasoning: extractOpenRouterReasoning(choice?.message),
        reasoningTokens: Number(usage?.completion_tokens_details?.reasoning_tokens || 0),
        promptTokens: Number(usage?.prompt_tokens || 0),
        completionTokens: Number(usage?.completion_tokens || 0),
        finishReason: String(choice?.finish_reason || 'unknown'),
        model: String(request.model || ''),
      };
      console.log(
        `OpenRouter ok model=${meta.model} provider=${routedProvider || 'unknown'} finish=${meta.finishReason} content_len=${meta.content.length} completion=${meta.completionTokens} reasoning=${meta.reasoningTokens}`,
      );
      if (!meta.content.trim() && meta.reasoning) {
        console.warn(
          `OpenRouter content empty with reasoning_len=${meta.reasoning.length}; JSON may have landed in thought`,
        );
      }
      return meta;
    }

    const response = await axios.post(API_URL, request, {
      ...config,
      headers: {
        ...config.headers,
        Accept: 'text/event-stream',
      },
      responseType: 'stream',
    });
    const state = await consumeOpenRouterSseStream(
      response.data as Readable,
      options.onReasoning,
      abortController,
    );
    const meta = metaFromAccumulation(state);
    console.log(
      `OpenRouter stream ok model=${meta.model} finish=${meta.finishReason} content_len=${meta.content.length} completion=${meta.completionTokens} reasoning=${meta.reasoningTokens} thought_len=${meta.reasoning.length}`,
    );
    return meta;
  };

  try {
    const meta = await runOnce();
    if (meta.content.trim()) {
      return meta;
    }
    const retry = nextOpenRouterLengthRetry(
      options.max_tokens,
      meta.finishReason,
      meta.content,
      Boolean(options.lengthRetry),
    );
    if (retry) {
      console.warn(
        `OpenRouter empty finish=${meta.finishReason} reasoning=${meta.reasoningTokens}; retrying max_tokens=${retry.max_tokens} with capped hidden thinking`,
      );
      return generateTextWithMeta(
        prompt,
        {
          ...options,
          max_tokens: retry.max_tokens,
          reasoning: retry.reasoning,
          lengthRetry: true,
        },
        abortController,
      );
    }
    throw new Error(
      `OpenRouter retornou resposta vazia (finish=${meta.finishReason}, reasoning_tokens=${meta.reasoningTokens})`,
    );
  } catch (error: any) {
    if (
      error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED' ||
      error.message === 'canceled'
    ) {
      console.log('Requisição cancelada pelo usuário');
      throw new Error('Requisição cancelada pelo usuário');
    }
    const status = Number(error?.response?.status || 0);
    if (useStream && status === 400) {
      console.warn(
        `OpenRouter stream 400; falling back to non-stream: ${openRouterErrorMessage(error)}`,
      );
      return generateTextWithMeta(
        prompt,
        { ...options, stream: false },
        abortController,
      );
    }
    logDetailedError(error);
    throw new Error(openRouterErrorMessage(error));
  }
};

/**
 * Função para enviar um prompt de texto para modelos de linguagem
 * @param prompt Texto para enviar ao modelo ou array de mensagens (histórico)
 * @param options Opções adicionais como temperatura, max_tokens, modelo e streaming
 * @param abortController Controlador para abortar a requisição (opcional)
 * @returns Promise com a resposta do modelo ou um stream
 */
export const generateText = async (
  prompt: string | Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    streaming?: boolean;
    timeout?: number;
    reasoning?: OpenRouterReasoning;
    response_format?: { type: 'json_object' | 'text' };
    lengthRetry?: boolean;
  } = {},
  abortController?: AbortController
): Promise<string | Readable> => {
  try {
    if (!OPENROUTER_API_KEY.trim()) {
      throw new Error('OPENROUTER_API_KEY nao configurada no servidor');
    }

    const streaming = options.streaming || false;

    // Constrói as mensagens baseado no tipo do prompt
    let messages: Array<{ role: string; content: string }>;
    if (Array.isArray(prompt)) {
      // Se for array, usa diretamente (histórico de conversa)
      messages = prompt;
    } else {
      // Se for string, cria mensagem simples do usuário
      messages = [{ role: 'user', content: prompt }];
    }

    const provider = openRouterProviderPreferences();
    const request: Record<string, unknown> = {
      model: toDefaultProviderModel(options.model || AVAILABLE_MODELS.DEEPSEEK_V4_FLASH),
      messages: messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: streaming,
      provider,
    };
    if (options.response_format) {
      request.response_format = options.response_format;
    }
    const reasoning = sanitizeOpenRouterReasoning(options.reasoning);
    if (reasoning) {
      request.reasoning = reasoning;
    }

    console.log(
      `Enviando texto para OpenRouter model=${request.model} streaming=${streaming} max_tokens=${options.max_tokens || 'default'} sort=${provider.sort} max_output=$${provider.max_price.completion}/M`,
    );

    // Configuração básica para a requisição
    const config = {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Referer': SITE_URL,
        'X-Title': SITE_NAME,
        'Content-Type': 'application/json'
      },
      signal: abortController ? abortController.signal : undefined,
      timeout: options.timeout || 180000,
    };

    if (streaming) {
      const response = await axios.post(API_URL, request, {
        ...config,
        headers: {
          ...config.headers,
          'Accept': 'text/event-stream'
        },
        responseType: 'stream'
      });

      return response.data;
    }

    const meta = await generateTextWithMeta(prompt, options, abortController);
    return meta.content;
  } catch (error: any) {
    // Verifica se o erro foi causado por um abort manual
    if (
      error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED' ||
      error.message === 'canceled'
    ) {
      console.log('Requisição cancelada pelo usuário');
      throw new Error('Requisição cancelada pelo usuário');
    }

    logDetailedError(error);
    throw new Error(openRouterErrorMessage(error));
  }
};

/**
 * Processa um stream de eventos SSE (Server-Sent Events) do OpenRouter
 * @param stream Stream de eventos
 * @param onData Callback chamado para cada pedaço de texto
 * @param onError Callback chamado em caso de erro
 * @param onComplete Callback chamado ao final do stream
 */
export const processStream = (
  stream: Readable,
  onData: (text: string) => void,
  onError: (error: Error) => void,
  onComplete: () => void
) => {
  let buffer = '';
  let accumulatedContent = ''; // Acumula conteúdo para enviar em blocos maiores
  let lastSendTime = Date.now();
  const CHUNK_SIZE_THRESHOLD = 50; // Tamanho mínimo para enviar um bloco
  const TIME_THRESHOLD_MS = 300; // Tempo máximo para segurar um bloco (300ms)

  // Função para enviar o conteúdo acumulado
  const sendAccumulatedContent = () => {
    if (accumulatedContent.length > 0) {
      onData(accumulatedContent);

      accumulatedContent = '';
      lastSendTime = Date.now();
    }
  };

  stream.on('data', (chunk) => {
    // Converte o buffer para string e adiciona ao buffer existente
    const chunkStr = chunk.toString();
    buffer += chunkStr;
    


    // Processa linhas completas
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Mantém a última linha incompleta no buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Pula linhas em branco e comentários
      if (!trimmedLine || trimmedLine.startsWith(':')) {
        continue;
      }
      
      // Processa eventos de dados
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.substring(5).trim();
        
        // Marcador de fim do stream
        if (data === '[DONE]') {

          sendAccumulatedContent(); // Envia qualquer conteúdo restante
          continue;
        }

        try {

          const parsedData = JSON.parse(data);
          
          // Extrai conteúdo baseado em diferentes formatos possíveis de modelo
          let content = null;
          
          // Formato OpenAI/OpenRouter padrão
          if (parsedData.choices && parsedData.choices[0]?.delta?.content) {
            content = parsedData.choices[0].delta.content;
          }
          // Formato alternativo de alguns modelos
          else if (parsedData.choices && parsedData.choices[0]?.text) {
            content = parsedData.choices[0].text;
          }
          // Formato Claude/Anthropic
          else if (parsedData.content) {
            content = parsedData.content;
          }
          // Formato de texto simples
          else if (parsedData.text) {
            content = parsedData.text;
          }
          // Formato delta em outros serviços
          else if (parsedData.delta && parsedData.delta.content) {
            content = parsedData.delta.content;
          }
          
          if (content) {
            // Acumula o conteúdo em vez de enviá-lo imediatamente
            accumulatedContent += content;
            
            // Verifica se deve enviar o bloco acumulado
            const currentTime = Date.now();
            const timeElapsed = currentTime - lastSendTime;
            
            // Envia se atingiu o tamanho mínimo ou se passou tempo suficiente
            if (accumulatedContent.length >= CHUNK_SIZE_THRESHOLD || timeElapsed >= TIME_THRESHOLD_MS) {
              sendAccumulatedContent();
            }
          }
          
          // Verifica erros nos dados
          if (parsedData.error) {
            console.error('Erro nos dados do stream:', parsedData.error);
            const errorMessage = parsedData.error.message || 'Erro no stream de dados';
            onError(new Error(errorMessage));
          }

          // Se for o último chunk, envia o done
          if (parsedData.done) {
            sendAccumulatedContent(); // Envia qualquer conteúdo restante
          }
        } catch (err) {
          console.error('Erro ao analisar resposta do stream:', err, 'Linha:', trimmedLine);
          // Se não for JSON válido mas tiver conteúdo, tenta enviar como texto
          if (data && data !== '[DONE]') {
            accumulatedContent += data;
            // Verifica se deve enviar o bloco acumulado
            if (accumulatedContent.length >= CHUNK_SIZE_THRESHOLD) {
              sendAccumulatedContent();
            }
          }
        }
      }
    }
  });

  stream.on('end', () => {
    // Envia qualquer conteúdo restante antes de finalizar
    sendAccumulatedContent();

    onComplete();
  });

  stream.on('error', (err) => {
    // Envia qualquer conteúdo restante antes de reportar o erro
    sendAccumulatedContent();
    console.error('Erro no stream:', err);
    onError(err);
  });
};

export default {
  AVAILABLE_MODELS,
  analyzeImage,
  generateText,
  processStream
};
