import * as pixPaymentController from '../controllers/pix.payment.controller';
import { verifyToken } from '../middlewares/auth';

const pixPaymentRoutes = (app: any) => {
  // Rota para criar uma cobrança Pix
  app.post("/pix/charge", {
    onRequest: [verifyToken],
    handler: pixPaymentController.createPixCharge
  });
  
  // Rota para consultar o status de uma cobrança Pix
  app.get("/pix/charge/:txid", {
    onRequest: [verifyToken],
    handler: pixPaymentController.getPixChargeStatus
  });
};

export default pixPaymentRoutes; 