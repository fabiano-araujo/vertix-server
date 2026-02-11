import * as creditsController from '../controllers/credits.controller';
import { verifyToken } from '../middlewares/auth';

const creditsRoutes = (app: any) => {
  app.get('/credits/:userId', {
    onRequest: [verifyToken],
    handler: creditsController.getUserCredits
  });

  app.post('/credits/device', {
    handler: creditsController.getDeviceCredits
  });

  app.post('/credits/device/reward', {
    handler: creditsController.addDeviceCredits
  });
};

export default creditsRoutes;
