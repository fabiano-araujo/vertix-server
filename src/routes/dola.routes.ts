import * as dolaController from '../controllers/dola.controller';

const dolaRoutes = (app: any) => {
  app.options('/dola-api/*', (_request: any, reply: any) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.send();
  });

  app.get('/dola-api/profiles', dolaController.getProfiles);
  app.get('/dola-api/config', dolaController.getConfig);
  app.post('/dola-api/jobs', dolaController.createJob);
  app.get('/dola-api/jobs/:jobId', dolaController.getJob);
};

export default dolaRoutes;
