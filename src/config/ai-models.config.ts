import { AVAILABLE_MODELS } from '../services/openrouter.service';

/**
 * Configuração de modelos simplificados para facilitar o uso da API
 */

// Aliases para facilitar o uso dos modelos
export const MODEL_ALIASES = {
  // Alias para conversação/chat (padrão)
  chat: AVAILABLE_MODELS.GPT_OSS_20B,
  
  // Alias para processamento de arquivos/documentos
  file: AVAILABLE_MODELS.GEMMA_3_12B_IT,
  
  // Alias para resumos em inglês
  summary_en: AVAILABLE_MODELS.GEMMA_3_12B_IT,
  
  // Alias para tarefas de codificação
  code: AVAILABLE_MODELS.MISTRAL_SMALL_3_1_24B,

  // Alias para modelo de qualidade boa (padrão)
  bom: AVAILABLE_MODELS.GPT_OSS_20B,
};

/**
 * Função para resolver um alias de modelo para o ID real do modelo
 * @param modelName Nome ou alias do modelo
 * @returns ID real do modelo para uso na API
 */
export const resolveModel = (modelName: string): string => {
  // Se não for fornecido, usa o modelo padrão para chat
  if (!modelName) {
    return MODEL_ALIASES.chat;
  }
  
  // Verificar se é um alias
  if (modelName in MODEL_ALIASES) {
    return MODEL_ALIASES[modelName as keyof typeof MODEL_ALIASES];
  }
  
  // Verificar se já é um ID válido de modelo
  const allModelIds = Object.values(AVAILABLE_MODELS);
  if (allModelIds.includes(modelName as any)) {
    return modelName;
  }
  
  // Casos especiais - detecção por conteúdo
  if (modelName.toLowerCase().includes('resumo') && modelName.toLowerCase().includes('english')) {
    return MODEL_ALIASES.summary_en;
  }
  
  // Se não for reconhecido, retorna o modelo padrão
  console.warn(`Modelo "${modelName}" não reconhecido, usando modelo padrão`);
  return MODEL_ALIASES.chat;
};

/**
 * Determina o melhor modelo com base no conteúdo do prompt
 * @param prompt Texto do prompt
 * @returns ID do modelo recomendado
 */
export const suggestModelByContent = (prompt: string): string => {
  const promptLower = prompt.toLowerCase();
  
  // Detecta pedido de resumo em inglês
  if (
    (promptLower.includes('resume') || promptLower.includes('summary')) && 
    (promptLower.includes('english') || promptLower.includes('inglês'))
  ) {
    return MODEL_ALIASES.summary_en;
  }
  
  // Detecta processamento de arquivo/documento
  if (
    promptLower.includes('arquivo') || 
    promptLower.includes('documento') || 
    promptLower.includes('file') || 
    promptLower.includes('document')
  ) {
    return MODEL_ALIASES.file;
  }

  // Detecta pedido de código
  if (
    promptLower.includes('código') ||
    promptLower.includes('code') ||
    promptLower.includes('programação') ||
    promptLower.includes('programming')
  ) {
    return MODEL_ALIASES.code;
  }
  
  // Se nenhuma condição específica for atendida, retorna o modelo de chat padrão
  return MODEL_ALIASES.chat;
};

export default {
  MODEL_ALIASES,
  resolveModel,
  suggestModelByContent
}; 