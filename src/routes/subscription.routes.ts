import * as subscriptionController from '../controllers/subscription.controller';
import { verifyToken } from '../middlewares/auth';

const subscriptionRoutes = (app: any) => {
  // Criar uma nova assinatura
  app.post("/subscription", {
    onRequest: [verifyToken],
    handler: subscriptionController.createSubscription
  });
  
  // Obter a assinatura ativa de um usuário
  app.get("/subscription/active/:userId", {
    onRequest: [verifyToken],
    handler: subscriptionController.getActiveSubscription
  });
  
  // Obter todas as assinaturas de um usuário
  app.get("/subscription/user/:userId", {
    onRequest: [verifyToken],
    handler: subscriptionController.getUserSubscriptions
  });
  
  // Cancelar uma assinatura
  app.delete("/subscription/:id", {
    onRequest: [verifyToken],
    handler: subscriptionController.cancelSubscription
  });
  
  // Verificar status premium do usuário
  app.get("/subscription/status/:userId", {
    onRequest: [verifyToken],
    handler: subscriptionController.checkUserPremiumStatus
  });
  
  // Obter configuração completa de assinatura para o frontend
  app.get("/subscription/config/:userId", {
    onRequest: [verifyToken],
    handler: subscriptionController.getSubscriptionConfig
  });
};

export default subscriptionRoutes; 