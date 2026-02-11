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

// Para debugging
console.log('API KEY (primeiros 10 caracteres):', OPENROUTER_API_KEY.substring(0, 10) + '...');

// Modelos disponíveis
export const AVAILABLE_MODELS = {
  // OpenAI Models
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  GPT_OSS_20B: 'openai/gpt-oss-20b',

  // Gemma models
  GEMMA_3_12B_IT: 'google/gemma-3-12b-it', // Corrigido de 8B para 12B
  GEMMA_3_4B_IT: 'google/gemma-3-4b-it',   // Corrigido de 2B para 4B
  GEMMA_3_27B_IT: 'google/gemma-3-27b-it',
  
  // Claude models
  CLAUDE_3_OPUS: 'anthropic/claude-3-opus:beta',
  CLAUDE_3_SONNET: 'anthropic/claude-3-sonnet',
  CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku',
  
  // Mistral models
  MISTRAL_SMALL_3_1_24B: 'mistralai/mistral-small-3.1-24b-instruct'
};

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
      model,
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
      stream: streaming
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
    if (error.name === 'AbortError' || error.message === 'canceled') {
      console.log('Requisição cancelada pelo usuário');
      throw new Error('Requisição cancelada pelo usuário');
    }
    
    logDetailedError(error);
    throw error;
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
  } = {},
  abortController?: AbortController
): Promise<string | Readable> => {
  try {
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

    // Versão simplificada para compatibilidade
    const request = {
      model: options.model || AVAILABLE_MODELS.GEMMA_3_27B_IT,
      messages: messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: streaming
    };

    console.log(`Enviando requisição para gerar texto com o modelo ${request.model} (streaming: ${streaming}):`, JSON.stringify(request, null, 2));

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
    if (error.name === 'AbortError' || error.message === 'canceled') {
      console.log('Requisição cancelada pelo usuário');
      throw new Error('Requisição cancelada pelo usuário');
    }
    
    logDetailedError(error);
    throw error;
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