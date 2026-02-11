import fastify from 'fastify';
import process from 'process';
import routes from './routes/index';
import path from 'path';
import * as subscriptionRepository from './repositories/subscription.repository';
const fastifyCors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');

const app = fastify({ logger: false });

app.register(fastifyCors, {
    origin: '*', // Permitir todas as origens. Ajuste conforme necessário.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos HTTP permitidos
});

app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/', // Acessível pela raiz
});

routes(app);

const start = async () => {
    try {
        // Limpar assinaturas pendentes expiradas na inicialização
        try {
            const cleanedCount = await subscriptionRepository.cleanupExpiredPendingSubscriptions();
            console.log(`Limpeza de assinaturas: ${cleanedCount} assinaturas pendentes expiradas foram processadas`);
        } catch (cleanupError) {
            console.error('Erro ao limpar assinaturas pendentes:', cleanupError);
            // Não interromper a inicialização do servidor por causa deste erro
        }

        // Configurar limpeza periódica a cada 6 horas
        setInterval(async () => {
            try {
                const cleanedCount = await subscriptionRepository.cleanupExpiredPendingSubscriptions();
                console.log(`Limpeza periódica: ${cleanedCount} assinaturas pendentes expiradas foram processadas`);
            } catch (error) {
                console.error('Erro na limpeza periódica de assinaturas:', error);
            }
        }, 6 * 60 * 60 * 1000); // 6 horas em milissegundos
        
        await app.listen({ port: 3005, host: '0.0.0.0' });
        console.log(`Servidor rodando em http://localhost:3005`);
    } catch (err) {
        console.error('Erro ao iniciar o servidor:', err);
        process.exit(1);
    }
};

start();
