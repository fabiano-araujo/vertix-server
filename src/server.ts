import fastify from 'fastify';
import cors from '@fastify/cors';
import userRoutes from './routes/user.routes';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import dotenv from 'dotenv';
import connectionService from './services/connection.service';

// Carrega variáveis de ambiente
dotenv.config();

// Configuração da porta
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Cria instância do Fastify
const app = fastify({ logger: true });

// Configura CORS
app.register(cors, {
  origin: true, // Permite todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

// Registra rotas
userRoutes(app);
authRoutes(app);
aiRoutes(app);

// Rota padrão
app.get('/', async (request, reply) => {
  return { hello: 'API Projeto Base está funcionando!' };
});

// Inicia o servidor
const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    
    // Configurar limpeza periódica de conexões antigas
    // Limpa conexões que estão ativas há mais de 30 minutos a cada 5 minutos
    setInterval(() => {
      connectionService.cleanupOldConnections(30 * 60 * 1000); // 30 minutos
    }, 5 * 60 * 1000); // 5 minutos
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Executa o servidor
start(); 