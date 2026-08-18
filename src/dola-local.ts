import fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import dolaRoutes from './routes/dola.routes';

const fastifyCors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');

const port = Number(process.env.DOLA_LOCAL_PORT || 3847);
const runsRoot = path.resolve(
  process.env.DOLA_RUNS_DIR || path.join(process.cwd(), 'public', 'dola-runs'),
);
fs.mkdirSync(runsRoot, { recursive: true });

const app = fastify({ logger: false });

app.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.register(fastifyStatic, {
  root: runsRoot,
  prefix: '/dola-runs/',
  decorateReply: false,
  setHeaders: (res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
});

dolaRoutes(app);

const start = async () => {
  try {
    fs.mkdirSync(runsRoot, { recursive: true });
    await app.listen({ port, host: '127.0.0.1' });
    console.log(`Gerador Dola local em http://127.0.0.1:${port}`);
    console.log('Perfil de crédito: Pre-Writes');
    console.log(`Sessão: ${process.env.DOLA_SESSION_FILE || 'C:/Users/Fabiano/dola-launcher/dola-session.json'}`);
  } catch (error) {
    console.error('Não foi possível iniciar o gerador Dola local:', error);
    process.exit(1);
  }
};

start();
