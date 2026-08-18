import * as openrouterVideoController from '../controllers/openrouter-video.controller';
import { verifyToken } from '../middlewares/auth';
import { verifyAdmin } from '../middlewares/admin';

const openrouterVideoRoutes = (app: any) => {
  const preHandler = async (request: any, reply: any) => {
    if (process.env.OPENROUTER_VIDEO_REQUIRE_AUTH === 'false') {
      return;
    }

    await verifyToken(request, reply);
    if (reply.sent) return;
    await verifyAdmin(request, reply);
  };

  app.options('/openrouter-video-api/*', (request: any, reply: any) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.send();
  });

  app.post('/openrouter-video-api/jobs', { preHandler }, openrouterVideoController.createVideoJob);
  app.post('/openrouter-video-api/jobs/:jobId/status', { preHandler }, openrouterVideoController.getVideoJobStatus);
  app.post('/openrouter-video-api/jobs/:jobId/download', { preHandler }, openrouterVideoController.downloadVideoJob);
  app.post('/openrouter-video-api/assemble', { preHandler }, openrouterVideoController.assembleVideos);
  app.post('/openrouter-video-api/models', { preHandler }, openrouterVideoController.listVideoModels);
  app.post('/openrouter-video-api/voice-references', { preHandler }, openrouterVideoController.generateVoiceReferences);
  app.post('/openrouter-video-api/dubbing', { preHandler }, openrouterVideoController.generateDubbing);
};

export default openrouterVideoRoutes;
