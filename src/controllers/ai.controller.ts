import { FastifyRequest, FastifyReply } from "fastify";
import openRouterService, { AVAILABLE_MODELS } from '../services/openrouter.service';
import { resolveModel, MODEL_ALIASES } from '../config/ai-models.config';
import { Readable } from 'stream';
import * as creditsRepository from '../repositories/credits.repository';
import * as connectionService from '../services/connection.service';
import { v4 as uuidv4 } from 'uuid';

// Interfaces para as requisiÃƒÂ§ÃƒÂµes
interface AnalyzeImageRequest {
  Body: {
    imageUrl?: string;
    imageBase64?: string;
    prompt?: string;
    model?: string;
    streaming?: boolean;
    userId?: number;
    deviceId?: string;
  };
}

interface GenerateTextRequest {
  Body: {
    prompt: string;
    temperature?: number;
    max_tokens?: number;
    model?: string;
    streaming?: boolean;
    userId?: number;
    deviceId?: string;
    documentCharCount?: number;
  };
}

// Constantes para consumo de crÃƒÂ©ditos
const CREDITS_PER_TEXT_REQUEST = 1;
const CREDITS_PER_IMAGE_REQUEST = 3;
const DOCUMENT_CHARS_PER_CREDIT = 300;

/**
 * Lista todos os modelos disponÃƒÂ­veis
 */
export const listModels = async (_req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Adiciona headers CORS para todas as respostas
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    
    const models = {
      // Modelos Gemma
      gemma: [
        { id: AVAILABLE_MODELS.GEMMA_3_4B_IT, name: 'Gemma 3 4B IT', description: 'Modelo menor e mais rÃƒÂ¡pido da sÃƒÂ©rie Gemma 3' },
        { id: AVAILABLE_MODELS.GEMMA_3_12B_IT, name: 'Gemma 3 12B IT', description: 'Modelo equilibrado entre velocidade e capacidade' },
        { id: AVAILABLE_MODELS.GEMMA_3_27B_IT, name: 'Gemma 3 27B IT', description: 'Modelo mais avanÃƒÂ§ado da sÃƒÂ©rie Gemma 3' }
      ],
      // Modelos Claude
      claude: [
        { id: AVAILABLE_MODELS.CLAUDE_3_HAIKU, name: 'Claude 3 Haiku', description: 'Modelo mais rÃƒÂ¡pido da sÃƒÂ©rie Claude 3' },
        { id: AVAILABLE_MODELS.CLAUDE_3_SONNET, name: 'Claude 3 Sonnet', description: 'Modelo equilibrado entre velocidade e capacidade' },
        { id: AVAILABLE_MODELS.CLAUDE_3_OPUS, name: 'Claude 3 Opus', description: 'Modelo mais avanÃƒÂ§ado da sÃƒÂ©rie Claude 3' }
      ],
      // Modelos Mistral
      mistral: [
        { id: AVAILABLE_MODELS.MISTRAL_SMALL_3_1_24B, name: 'Mistral Small 3.1 24B', description: 'Modelo Mistral Small 3.1 com 24 bilhÃƒÂµes de parÃƒÂ¢metros' }
      ],
      // Aliases simplificados
      aliases: Object.entries(MODEL_ALIASES).map(([alias, modelId]) => ({
        alias,
        modelId,
        description: `Alias para ${modelId}`
      }))
    };
    
    reply.send({
      success: true,
      data: {
        models
      }
    });
  } catch (error: any) {
    console.error('Erro ao listar modelos:', error);
    reply.code(500).send({
      success: false,
      message: 'Erro interno ao listar modelos'
    });
  }
};

/**
 * AnÃƒÂ¡lise de imagem usando modelos de IA
 */
export const analyzeImage = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Adiciona headers CORS para todas as respostas
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    
    let imageUrl, imageBase64, prompt, model, streaming, userId, deviceId;
    
    // Verifica se ÃƒÂ© uma requisiÃƒÂ§ÃƒÂ£o GET ou POST e extrai os parÃƒÂ¢metros de acordo
    if (req.method === 'GET') {
      // Para EventSource (GET)
      const query = req.query as any;
      imageUrl = query.imageUrl;
      imageBase64 = query.imageBase64;
      prompt = query.prompt;
      model = query.model;
      streaming = query.streaming === 'true';
      userId = query.userId ? parseInt(query.userId) : undefined;
      deviceId = typeof query.deviceId === 'string' ? query.deviceId : undefined;
      
      console.log('RequisiÃƒÂ§ÃƒÂ£o GET para anÃƒÂ¡lise de imagem recebida:', {
        imageUrl: imageUrl?.substring(0, 50) + '...',
        imageBase64: imageBase64 ? 'Presente (string base64)' : 'Ausente',
        model,
        streaming,
        userId: userId || 'não fornecido',
        deviceId: deviceId || 'não fornecido',
      });
    } else {
      // Para fetch normal (POST)
      const body = (req.body as any) || {};
      imageUrl = body.imageUrl;
      imageBase64 = body.imageBase64;
      prompt = body.prompt;
      model = body.model;
      streaming = body.streaming;
      userId = body.userId ? parseInt(body.userId) : undefined;
      deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined;
      
      console.log('RequisiÃƒÂ§ÃƒÂ£o POST para anÃƒÂ¡lise de imagem recebida:', {
        imageUrl: imageUrl?.substring(0, 50) + '...',
        imageBase64: imageBase64 ? 'Presente (string base64)' : 'Ausente',
        model,
        streaming,
        userId: userId || 'não fornecido',
        deviceId: deviceId || 'não fornecido',
      });
    }
    
    // Verifica se o userId foi fornecido e consome crÃƒÂ©ditos apenas se ele existir
    let hasCredits = true;
    if (userId && !isNaN(userId)) {
      hasCredits = await creditsRepository.consumeCredits(userId, CREDITS_PER_IMAGE_REQUEST);
    } else if (deviceId && deviceId.trim().length >= 6) {
      hasCredits = await creditsRepository.consumeDeviceCredits(deviceId.trim(), CREDITS_PER_IMAGE_REQUEST);
    }

    if (!hasCredits) {
      return reply.code(403).send({
        success: false,
        message: 'CrÃ©ditos insuficientes para analisar imagem'
      });
    }
    
    // Verifica se pelo menos um dos formatos de imagem foi fornecido
    if ((!imageUrl || typeof imageUrl !== 'string') && (!imageBase64 || typeof imageBase64 !== 'string')) {
      return reply.code(400).send({
        success: false,
        message: 'URL da imagem ou imagem em base64 ÃƒÂ© obrigatÃƒÂ³ria e deve ser uma string vÃƒÂ¡lida'
      });
    }

    // ValidaÃƒÂ§ÃƒÂ£o de URL, se fornecida
    if (imageUrl && typeof imageUrl === 'string') {
      try {
        new URL(imageUrl);
      } catch (e) {
        return reply.code(400).send({
          success: false,
          message: 'URL da imagem invÃƒÂ¡lida'
        });
      }
    }

    // ValidaÃƒÂ§ÃƒÂ£o bÃƒÂ¡sica de base64, se fornecido
    if (imageBase64 && typeof imageBase64 === 'string') {
      // Verifica se ÃƒÂ© uma string base64 vÃƒÂ¡lida (pode comeÃƒÂ§ar com data:image/...;base64,)
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=])+$|^([A-Za-z0-9+/=])+$/;
      if (!base64Regex.test(imageBase64)) {
        return reply.code(400).send({
          success: false,
          message: 'Formato de imagem base64 invÃƒÂ¡lido'
        });
      }
    }

    // Se não for especificado um modelo, ou se for um alias de qualidade, mapeia para o modelo correto
    let selectedModel;
    const requestedModel = model?.toLowerCase(); // Garantir minÃƒÂºsculas para comparaÃƒÂ§ÃƒÂ£o

    if (requestedModel === 'otimo') {
      selectedModel = AVAILABLE_MODELS.GPT_4O_MINI; 
    } else if (requestedModel === 'equilibrado') {
      selectedModel = AVAILABLE_MODELS.GEMMA_3_27B_IT;
    } else if (requestedModel === 'baixo') {
      selectedModel = AVAILABLE_MODELS.GEMMA_3_12B_IT;
    } else if (requestedModel === 'bom') {
      selectedModel = AVAILABLE_MODELS.GPT_OSS_20B;
    } else if (requestedModel) {
      // Tenta resolver como um alias ou nome de modelo direto
      selectedModel = resolveModel(requestedModel);
    } else {
      // Se nenhum modelo foi passado, usa o padrão GPT_OSS_20B
      console.warn('Nenhum modelo especificado para análise de imagem. Usando modelo padrão GPT_OSS_20B.');
      selectedModel = AVAILABLE_MODELS.GPT_OSS_20B;
    }
    
    // Define o modelo padrÃƒÂ£o se a resoluÃƒÂ§ÃƒÂ£o falhar ou for invÃƒÂ¡lida apÃƒÂ³s as verificaÃƒÂ§ÃƒÂµes
    if (!selectedModel || !Object.values(AVAILABLE_MODELS).includes(selectedModel)) {
        console.warn(`Modelo invÃƒÂ¡lido ou não encontrado apÃƒÂ³s mapeamento/resoluÃƒÂ§ÃƒÂ£o: ${model}. Usando modelo padrÃƒÂ£o Baixo Detalhe como fallback final.`);
        selectedModel = AVAILABLE_MODELS.GEMMA_3_12B_IT; // Modelo de fallback final
    }

    const useStreaming = streaming || false;
    
    console.log(`Usando modelo para anÃƒÂ¡lise de imagem: ${selectedModel} (streaming: ${useStreaming})`);

    // Determina qual formato de imagem usar (prioriza URL se ambos forem fornecidos)
    const imageSource = imageUrl 
      ? { type: 'url' as const, data: imageUrl } 
      : { type: 'base64' as const, data: imageBase64 };
      
    // Cria um AbortController para permitir cancelamento da requisiÃƒÂ§ÃƒÂ£o
    const abortController = new AbortController();
    
    // Gera um ID ÃƒÂºnico para esta conexÃƒÂ£o
    const connectionId = uuidv4();
      
    const result = await openRouterService.analyzeImage(imageSource, prompt, selectedModel, useStreaming, abortController);
    
    // Se for streaming, processa o stream
    if (useStreaming && result instanceof Readable) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      
      // NecessÃƒÂ¡rio para CORS quando usado com EventSource
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      
      // Registra a conexÃƒÂ£o para possÃƒÂ­vel interrupÃƒÂ§ÃƒÂ£o posterior
      if (userId && !isNaN(userId)) {
        connectionService.registerConnection(connectionId, reply, userId, result, abortController);
      } else {
        // Para conexÃƒÂµes sem usuÃƒÂ¡rio, ainda registre a conexÃƒÂ£o, mas com userId 0 (para representar usuÃƒÂ¡rio anÃƒÂ´nimo)
        connectionService.registerConnection(connectionId, reply, 0, result, abortController);
      }
      
      // FunÃƒÂ§ÃƒÂ£o para enviar dados ao cliente com seguranÃƒÂ§a
      const safeSend = (data: any) => {
        if (!reply.sent && !reply.raw.destroyed) {
          try {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (error: any) {
            console.warn(`Falha ao enviar dados para cliente, conexÃƒÂ£o possivelmente fechada: ${error.message}`);
          }
        }
      };
      
      // FunÃƒÂ§ÃƒÂ£o para finalizar a resposta com seguranÃƒÂ§a
      const safeEnd = () => {
        if (!reply.sent && !reply.raw.destroyed) {
          try {
            reply.raw.end();
          } catch (error: any) {
            console.warn(`Falha ao finalizar resposta, conexÃƒÂ£o possivelmente fechada: ${error.message}`);
          }
        }
      };
      
      // Envia um evento inicial para confirmar a conexÃƒÂ£o e fornecer o ID
      safeSend({ status: "conectado", connectionId: connectionId });
      
      openRouterService.processStream(
        result,
        (text) => {
          safeSend({ text });
        },
        (error) => {
          safeSend({ error: error.message });
          safeEnd();
          
          // Finaliza a conexÃƒÂ£o no serviÃƒÂ§o
          connectionService.finishConnection(connectionId);
        },
        () => {
          safeSend({ done: true });
          safeEnd();
          
          // Finaliza a conexÃƒÂ£o no serviÃƒÂ§o
          connectionService.finishConnection(connectionId);
        }
      );
      
      return;
    }
    
    // Caso não seja streaming, retorna a resposta completa
    reply.send({
      success: true,
      data: {
        text: result,
        model: selectedModel
      }
    });
  } catch (error: any) {
    console.error('Erro ao analisar imagem:', error);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error?.message || 'Erro interno ao analisar imagem';
    
    reply.code(statusCode).send({
      success: false,
      message: errorMessage
    });
  }
};

/**
 * GeraÃƒÂ§ÃƒÂ£o de texto usando modelos de IA
 */
export const generateText = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Adiciona headers CORS para todas as respostas
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    
    let prompt, temperature, maxTokens, model, streaming, userId, deviceId, documentCharCount;
    
    // Verifica se ÃƒÂ© uma requisiÃƒÂ§ÃƒÂ£o GET ou POST e extrai os parÃƒÂ¢metros de acordo
    if (req.method === 'GET') {
      // Para EventSource (GET)
      const query = req.query as any;
      prompt = query.prompt;
      temperature = query.temperature ? parseFloat(query.temperature) : undefined;
      maxTokens = query.max_tokens ? parseInt(query.max_tokens) : undefined;
      model = query.model;
      streaming = query.streaming === 'true';
      userId = query.userId ? parseInt(query.userId) : undefined;
      deviceId = typeof query.deviceId === 'string' ? query.deviceId : undefined;
      if (query.documentCharCount !== undefined) {
        const parsedChars = parseInt(query.documentCharCount, 10);
        if (!isNaN(parsedChars)) {
          documentCharCount = parsedChars;
        }
      }
      console.log('RequisiÃƒÂ§ÃƒÂ£o GET para geraÃƒÂ§ÃƒÂ£o de texto recebida:', {
        promptLength: prompt?.length,
        temperature,
        maxTokens,
        model,
        streaming,
        userId: userId || 'não fornecido',
        deviceId: deviceId || 'não fornecido',
      });
    } else {
      // Para fetch normal (POST)
      const body = (req.body as any) || {};
      prompt = body.prompt;
      temperature = body.temperature ? parseFloat(body.temperature) : undefined;
      maxTokens = body.max_tokens ? parseInt(body.max_tokens) : undefined;
      model = body.model;
      streaming = body.streaming;
      userId = body.userId ? parseInt(body.userId) : undefined;
      deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined;
      if (body.documentCharCount !== undefined) {
        const parsedChars = typeof body.documentCharCount === 'number'
          ? body.documentCharCount
          : parseInt(body.documentCharCount, 10);
        if (!isNaN(parsedChars)) {
          documentCharCount = parsedChars;
        }
      }
    }
    
    // Verifica se o userId foi fornecido e consome crÃƒÂ©ditos apenas se ele existir
    const creditsToConsume = (() => {
      const minimumCredits = CREDITS_PER_TEXT_REQUEST;
      if (typeof documentCharCount === 'number' && documentCharCount > 0) {
        return Math.max(minimumCredits, Math.ceil(documentCharCount / DOCUMENT_CHARS_PER_CREDIT));
      }
      return minimumCredits;
    })();

    let hasCredits = true;
    if (userId && !isNaN(userId)) {
      hasCredits = await creditsRepository.consumeCredits(userId, creditsToConsume);
    } else if (deviceId && deviceId.trim().length >= 6) {
      hasCredits = await creditsRepository.consumeDeviceCredits(deviceId.trim(), creditsToConsume);
    }

    if (!hasCredits) {
      return reply.code(403).send({
        success: false,
        message: 'CrÃ©ditos insuficientes para gerar texto'
      });
    }
    
    // Validar que o prompt foi fornecido
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return reply.code(400).send({
        success: false,
        message: 'O prompt ÃƒÂ© obrigatÃƒÂ³rio e deve ser uma string não-vazia'
      });
    }

    // Validar temperatura (entre 0 e 1)
    if (temperature !== undefined && (isNaN(temperature) || temperature < 0 || temperature > 1)) {
      return reply.code(400).send({
        success: false,
        message: 'A temperatura deve ser um nÃƒÂºmero entre 0 e 1'
      });
    }

    // Validar max_tokens (entre 1 e 4096)
    if (maxTokens !== undefined && (isNaN(maxTokens) || maxTokens <= 0 || maxTokens > 4096)) {
      return reply.code(400).send({
        success: false,
        message: 'O nÃƒÂºmero mÃƒÂ¡ximo de tokens deve ser um nÃƒÂºmero entre 1 e 4096'
      });
    }

    // Se não for especificado um modelo, ou se for um alias de qualidade, mapeia para o modelo correto
    let selectedModel;
    const requestedModel = model?.toLowerCase(); // Garantir minÃƒÂºsculas para comparaÃƒÂ§ÃƒÂ£o

    if (requestedModel === 'otimo') {
      selectedModel = AVAILABLE_MODELS.GPT_4O_MINI;
    } else if (requestedModel === 'bom') {
      selectedModel = AVAILABLE_MODELS.GPT_OSS_20B;
    } else if (requestedModel === 'equilibrado') {
      selectedModel = AVAILABLE_MODELS.GEMMA_3_27B_IT;
    } else if (requestedModel === 'baixo') {
      selectedModel = AVAILABLE_MODELS.GEMMA_3_12B_IT;
    } else if (requestedModel) {
      // Tenta resolver como um alias ou nome de modelo direto
      selectedModel = resolveModel(requestedModel);
    } else {
      // Se nenhum modelo foi passado, usa o padrão GPT_OSS_20B
      console.warn('Nenhum modelo especificado. Usando modelo padrão GPT_OSS_20B.');
      selectedModel = AVAILABLE_MODELS.GPT_OSS_20B;
    }

    // Define o modelo padrão se a resolução falhar ou for inválida após as verificações
    if (!selectedModel || !Object.values(AVAILABLE_MODELS).includes(selectedModel)) {
        console.warn(`Modelo inválido ou não encontrado após mapeamento/resolução: ${model}. Usando modelo padrão GPT_OSS_20B como fallback final.`);
        selectedModel = AVAILABLE_MODELS.GPT_OSS_20B; // Modelo de fallback final
    }

    const useStreaming = streaming || false;
    
    console.log(`Usando modelo para geraÃƒÂ§ÃƒÂ£o de texto: ${selectedModel} (streaming: ${useStreaming})`);

    // Cria um AbortController para permitir cancelamento da requisiÃƒÂ§ÃƒÂ£o
    const abortController = new AbortController();
    
    // Gera um ID ÃƒÂºnico para esta conexÃƒÂ£o
    const connectionId = uuidv4();

    // Envia a solicitaÃƒÂ§ÃƒÂ£o para o serviÃƒÂ§o
    const result = await openRouterService.generateText(prompt, {
      temperature,
      max_tokens: maxTokens,
      model: selectedModel,
      streaming: useStreaming
    }, abortController);
    
    // Se for streaming, processa o stream
    if (useStreaming && result instanceof Readable) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      
      // NecessÃƒÂ¡rio para CORS quando usado com EventSource
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      
      // Registra a conexÃƒÂ£o para possÃƒÂ­vel interrupÃƒÂ§ÃƒÂ£o posterior
      if (userId && !isNaN(userId)) {
        connectionService.registerConnection(connectionId, reply, userId, result, abortController);
      } else {
        // Para conexÃƒÂµes sem usuÃƒÂ¡rio, ainda registre a conexÃƒÂ£o, mas com userId 0 (para representar usuÃƒÂ¡rio anÃƒÂ´nimo)
        connectionService.registerConnection(connectionId, reply, 0, result, abortController);
      }
      
      // FunÃƒÂ§ÃƒÂ£o para enviar dados ao cliente com seguranÃƒÂ§a
      const safeSend = (data: any) => {
        if (!reply.sent && !reply.raw.destroyed) {
          try {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (error: any) {
            console.warn(`Falha ao enviar dados para cliente, conexÃƒÂ£o possivelmente fechada: ${error.message}`);
          }
        }
      };
      
      // FunÃƒÂ§ÃƒÂ£o para finalizar a resposta com seguranÃƒÂ§a
      const safeEnd = () => {
        if (!reply.sent && !reply.raw.destroyed) {
          try {
            reply.raw.end();
          } catch (error: any) {
            console.warn(`Falha ao finalizar resposta, conexÃƒÂ£o possivelmente fechada: ${error.message}`);
          }
        }
      };
      
      // Envia um evento inicial para confirmar a conexÃƒÂ£o e fornecer o ID
      safeSend({ status: "conectado", connectionId: connectionId });
      
      openRouterService.processStream(
        result,
        (text) => {
          safeSend({ text });
        },
        (error) => {
          safeSend({ error: error.message });
          safeEnd();
          
          // Finaliza a conexÃƒÂ£o no serviÃƒÂ§o
          connectionService.finishConnection(connectionId);
        },
        () => {
          safeSend({ done: true });
          safeEnd();
          
          // Finaliza a conexÃƒÂ£o no serviÃƒÂ§o
          connectionService.finishConnection(connectionId);
        }
      );
      
      return;
    }
    
    // Caso não seja streaming, retorna a resposta completa
    reply.send({
      success: true,
      data: {
        text: result,
        model: selectedModel
      }
    });
  } catch (error: any) {
    console.error('Erro ao gerar texto:', error);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error?.message || 'Erro interno ao gerar texto';
    
    reply.code(statusCode).send({
      success: false,
      message: errorMessage
    });
  }
};

/**
 * Interrompe uma conexÃƒÂ£o ativa
 */
export const stopGeneration = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // Adiciona headers CORS para todas as respostas
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    
    const { connectionId, userId } = req.query as { connectionId?: string, userId?: string };
    console.log(`############## conexaoID= ${connectionId} pelo usuÃƒÂ¡rio ${userId}`);
    // Valida os parÃƒÂ¢metros
    if (!connectionId) {
      return reply.code(400).send({
        success: false,
        message: 'ID da conexÃƒÂ£o ÃƒÂ© obrigatÃƒÂ³rio'
      });
    }
    
    if (userId && isNaN(parseInt(userId))) {
      return reply.code(400).send({
        success: false,
        message: 'ID do usuÃƒÂ¡rio deve ser um nÃƒÂºmero vÃƒÂ¡lido'
      });
    }
    
    console.log(`Tentativa de interromper conexÃƒÂ£o ${connectionId}${userId ? ` pelo usuÃƒÂ¡rio ${userId}` : ''}`);
    
    try {
      // Tenta interromper a conexÃƒÂ£o
      const success = connectionService.stopConnection(connectionId);
      
      if (success) {
        console.log(`InterrupÃƒÂ§ÃƒÂ£o bem-sucedida para conexÃƒÂ£o ${connectionId}`);
        reply.send({
          success: true,
          message: 'GeraÃƒÂ§ÃƒÂ£o interrompida com sucesso'
        });
      } else {
        console.log(`Falha ao interromper conexÃƒÂ£o ${connectionId}: não encontrada ou jÃƒÂ¡ finalizada`);
        reply.code(404).send({
          success: false,
          message: 'ConexÃƒÂ£o não encontrada ou jÃƒÂ¡ finalizada'
        });
      }
    } catch (stopError: any) {
      // Captura erros especÃƒÂ­ficos da tentativa de interrupÃƒÂ§ÃƒÂ£o
      console.error(`Erro ao tentar interromper a conexÃƒÂ£o ${connectionId}:`, stopError);
      reply.code(500).send({
        success: false,
        message: `Erro ao interromper conexÃƒÂ£o: ${stopError.message || 'Erro interno'}`
      });
    }
  } catch (error: any) {
    // Captura erros gerais da rota
    console.error('Erro geral ao processar solicitaÃƒÂ§ÃƒÂ£o de interrupÃƒÂ§ÃƒÂ£o:', error);
    
    reply.code(500).send({
      success: false,
      message: 'Erro interno ao interromper geraÃƒÂ§ÃƒÂ£o'
    });
  }
};

export default {
  listModels,
  analyzeImage,
  generateText,
  stopGeneration
}; 







