import { FastifyReply } from 'fastify';
import { Readable } from 'stream';

interface ActiveConnection {
  reply: FastifyReply;
  stream?: Readable;
  abortController?: AbortController;
  userId: number;
  timestamp: number;
  isClosed: boolean;
}

// Armazena as conexões ativas por ID de requisição
const activeConnections: Map<string, ActiveConnection> = new Map();

/**
 * Registra uma nova conexão ativa
 * @param connectionId Identificador único da conexão
 * @param reply Objeto FastifyReply para responder ao cliente
 * @param stream Stream de dados (opcional)
 * @param abortController Controlador para abortar a requisição (opcional)
 * @param userId ID do usuário
 * @returns O ID da conexão registrada
 */
export const registerConnection = (
  connectionId: string,
  reply: FastifyReply,
  userId: number,
  stream?: Readable,
  abortController?: AbortController
): string => {
  // Armazena a conexão com um timestamp
  activeConnections.set(connectionId, {
    reply,
    stream,
    abortController,
    userId,
    timestamp: Date.now(),
    isClosed: false
  });
  
  console.log(`Conexão registrada: ${connectionId} (Usuário: ${userId})`);
  
  return connectionId;
};

/**
 * Interrompe uma conexão ativa pelo ID
 * @param connectionId ID da conexão a ser interrompida
 * @returns true se a conexão foi interrompida com sucesso, false caso contrário
 */
export const stopConnection = (connectionId: string): boolean => {
  const connection = activeConnections.get(connectionId);
  
  if (!connection) {
    console.log(`Tentativa de interromper conexão inexistente: ${connectionId}`);
    return false;
  }
  
  // Se a conexão já foi fechada, apenas retorna sucesso
  if (connection.isClosed) {
    console.log(`Conexão ${connectionId} já havia sido fechada anteriormente`);
    return true;
  }
  
  try {
    // Marca a conexão como fechada imediatamente para evitar operações duplicadas
    connection.isClosed = true;
    
    // Tenta abortar a requisição se houver um AbortController
    if (connection.abortController) {
      connection.abortController.abort();
    }
    
    // Finaliza o stream se existir
    if (connection.stream) {
      // Em vez de emitir um erro, registramos o evento e encerramos o stream diretamente
      console.log(`Interrompendo stream para conexão ${connectionId}`);
      
      // Se tiver um método destroy, utiliza
      if (typeof connection.stream.destroy === 'function') {
        // Destroi o stream sem emitir um erro
        connection.stream.destroy();
      } else {
        // Para streams mais antigos que não têm método destroy
        // Ainda podemos usar o evento de erro, mas vamos silenciá-lo
        // Primeiro adicionamos um listener para evitar que o erro seja impresso no console
        connection.stream.once('error', () => {
          // Listener vazio apenas para evitar que o erro seja impresso no console
        });
        
        // Agora emitimos o evento
        connection.stream.emit('error', new Error(''));
      }
    }
    
    // Finaliza a resposta HTTP se ainda não foi finalizada
    if (!connection.reply.sent) {
      try {
        connection.reply.raw.write(`data: ${JSON.stringify({ error: 'Conexão interrompida pelo usuário', done: true })}\n\n`);
        connection.reply.raw.end();
      } catch (writeError) {
        // Ignora erros de escrita, pois o stream pode já ter sido fechado
        console.log(`Aviso: Não foi possível escrever na resposta para ${connectionId}, provavelmente já foi fechada`);
      }
    }
    
    // Remove a conexão da lista de conexões ativas
    activeConnections.delete(connectionId);
    
    console.log(`Conexão interrompida com sucesso: ${connectionId}`);
    return true;
  } catch (error) {
    console.error(`Erro ao interromper conexão ${connectionId}:`, error);
    
    // Mesmo se ocorrer erro, marca como fechada e remove da lista
    connection.isClosed = true;
    activeConnections.delete(connectionId);
    
    return false;
  }
};

/**
 * Finaliza uma conexão ativa após seu uso normal (sem interrupção)
 * @param connectionId ID da conexão a ser finalizada
 */
export const finishConnection = (connectionId: string): void => {
  const connection = activeConnections.get(connectionId);
  
  if (!connection) {
    return;
  }
  
  // Marca como fechada e remove da lista
  connection.isClosed = true;
  activeConnections.delete(connectionId);
  console.log(`Conexão finalizada normalmente: ${connectionId}`);
};

/**
 * Lista todas as conexões ativas do usuário
 * @param userId ID do usuário
 * @returns Array com os IDs das conexões ativas do usuário
 */
export const listUserConnections = (userId: number): string[] => {
  const userConnections: string[] = [];
  
  for (const [connectionId, connection] of activeConnections.entries()) {
    if (connection.userId === userId && !connection.isClosed) {
      userConnections.push(connectionId);
    }
  }
  
  return userConnections;
};

/**
 * Limpa conexões antigas inativas
 * @param maxAgeMs Idade máxima em milissegundos (padrão: 30 minutos)
 */
export const cleanupOldConnections = (maxAgeMs: number = 30 * 60 * 1000): void => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [connectionId, connection] of activeConnections.entries()) {
    if (now - connection.timestamp > maxAgeMs) {
      stopConnection(connectionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Limpeza de conexões: ${cleanedCount} conexões antigas removidas`);
  }
};

// Exportar funções para uso em outros módulos
export default {
  registerConnection,
  stopConnection,
  finishConnection,
  listUserConnections,
  cleanupOldConnections
}; 