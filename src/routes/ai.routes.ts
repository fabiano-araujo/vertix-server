import * as aiController from '../controllers/ai.controller';

const aiRoutes = (app: any) => {
  // Configuração de CORS para as rotas de AI
  app.options('/ai/*', (req: any, reply: any) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.send();
  });
  
  // Rota para listar modelos disponíveis
  app.get('/ai/models', aiController.listModels);
  
  // Rotas para análise de imagens
  // userId é opcional; se não for fornecido, não haverá consumo de créditos
  app.post('/ai/analyze-image', aiController.analyzeImage);
  app.get('/ai/analyze-image', aiController.analyzeImage); // Nova rota GET para streaming com EventSource
  
  // Rotas para geração de texto
  // userId é opcional; se não for fornecido, não haverá consumo de créditos
  app.post('/ai/generate-text', aiController.generateText);
  app.get('/ai/generate-text', aiController.generateText); // Nova rota GET para streaming com EventSource
  
  // Rota para interromper uma geração em andamento
  // userId é opcional para interrupção
  app.get('/ai/stop-generation', aiController.stopGeneration);
};

export default aiRoutes;