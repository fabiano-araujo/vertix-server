import * as authController from '../controllers/auth.controller';

const authRoutes = (app: any) => {
    // Rota para login com email e senha
    app.post("/auth/login", authController.login);
    
    // Rota para registro de novo usuário
    app.post("/auth/registro", authController.registro);
    
    // Rota para login/registro com Google
    app.post("/auth/google", authController.googleLogin);
    
    // Rota para gerar um token de teste (apenas para ambiente de desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
        app.post("/auth/test-token", authController.getTestToken);
    }
};

export default authRoutes; 