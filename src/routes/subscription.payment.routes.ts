import * as subscriptionPaymentController from '../controllers/subscription.payment.controller';
import { verifyToken } from '../middlewares/auth';

const subscriptionPaymentRoutes = (app: any) => {
  // Criar um pagamento para assinatura (gera QR code)
  app.post("/subscription/payment", {
    onRequest: [verifyToken],
    handler: subscriptionPaymentController.createSubscriptionPayment
  });
  
  // Verificar status de um pagamento específico
  app.get("/subscription/payment/:paymentId", {
    onRequest: [verifyToken],
    handler: subscriptionPaymentController.checkSubscriptionPaymentStatus
  });
  
  // Webhook para receber notificações do Mercado Pago
  // Não precisa de autenticação pois é chamado pelo Mercado Pago
  app.post("/webhook/mercadopago", {
    handler: subscriptionPaymentController.mercadoPagoWebhook
  });
};

export default subscriptionPaymentRoutes; 