import { FastifyRequest, FastifyReply } from "fastify";
import * as userRepository from '../repositories/user.repository';
import * as subscriptionRepository from '../repositories/subscription.repository';
import * as creditsRepository from '../repositories/credits.repository';
import { gerarToken, verificarSenha } from '../helpers/auth.helper';
import { usuarioValidation } from '../validations/usuario.validation';
import { checkPendingPaymentsForUser } from './subscription.payment.controller';

interface LoginRequest {
    email: string;
    senha: string;
}

interface GoogleLoginRequest {
    email: string;
    name: string;
    googleId: string;
    photo?: string; // URL da foto de perfil do usuário no Google
}

/**
 * Obter informações sobre o status da assinatura de um usuário
 */
const getUserSubscriptionStatus = async (userId: number) => {
    // Verificar se há pagamentos pendentes e atualizar status se necessário
    const paymentUpdated = await checkPendingPaymentsForUser(userId);
    
    // Se houve atualização de pagamento, refazer a busca para obter dados atualizados
    if (paymentUpdated) {
        console.log(`Status de pagamento atualizado para o usuário ${userId}. Obtendo dados da assinatura...`);
    }
    
    const subscription = await subscriptionRepository.findActiveSubscriptionByUserId(userId);
    const hasActiveSubscription = !!subscription;
    const planType = subscription ? subscription.planType : 'free';
    
    return {
        isPremium: hasActiveSubscription,
        planType,
        expirationDate: subscription ? subscription.expirationDate : null
    };
};

/**
 * Controlador para login com email e senha
 */
export const login = async (req: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    try {
        const { email, senha } = req.body;

        // Verificar se o email existe
        const user = await userRepository.findUserByEmail(email) as any;
        if (!user) {
            return reply.code(401).send({ 
                success: false, 
                message: 'Email ou senha inválidos' 
            });
        }

        // Verificar se o usuário possui senha (não é apenas login com Google)
        if (!user.password) {
            return reply.code(401).send({ 
                success: false, 
                message: 'Esta conta usa autenticação com Google. Por favor, use o login com Google.' 
            });
        }

        // Verificar se a senha está correta
        const senhaValida = await verificarSenha(senha, user.password);
        if (!senhaValida) {
            return reply.code(401).send({ 
                success: false, 
                message: 'Email ou senha inválidos' 
            });
        }

        // Verificar status da assinatura
        const subscriptionStatus = await getUserSubscriptionStatus(user.id);

        // Obtém os créditos disponíveis do usuário
        const userCredits = await creditsRepository.getUserCredits(user.id);

        // Gerar token JWT
        const token = gerarToken(user);

        // Retornar usuário e token
        return reply.code(200).send({
            success: true,
            message: 'Login realizado com sucesso',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                photo: user.photo,
                subscription: subscriptionStatus,
                credits: {
                    available: userCredits.availableCredits,
                    lastReset: userCredits.lastReset
                }
            },
            token
        });
    } catch (error: any) {
        console.error('Erro ao fazer login:', error);
        return reply.code(500).send({ 
            success: false, 
            message: 'Erro ao fazer login', 
            error: error.message 
        });
    }
};

/**
 * Controlador para registro de novo usuário
 */
export const registro = async (req: FastifyRequest<{ Body: { nome: string, email: string, senha: string, photo?: string } }>, reply: FastifyReply) => {
    try {
        // Validar dados do usuário
        try {
            await usuarioValidation.validate(req.body);
        } catch (validationError: any) {
            return reply.code(400).send({ 
                success: false, 
                message: validationError.message 
            });
        }

        const { nome, email, senha, photo } = req.body;

        // Criar o usuário no banco de dados
        const user = await userRepository.createUser({
            id: 0, // O banco de dados irá gerar o ID
            name: nome,
            email,
            password: senha,
            photo
        }) as any;

        // Obtém os créditos disponíveis do usuário
        const userCredits = await creditsRepository.getUserCredits(user.id);
            
        // Obtém o status da assinatura do usuário (para novos usuários será 'free')
        const subscriptionStatus = await getUserSubscriptionStatus(user.id);

        // Gerar token JWT
        const token = gerarToken(user);

        // Retornar usuário e token
        return reply.code(201).send({
            success: true,
            message: 'Registro realizado com sucesso',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                photo: user.photo,
                subscription: subscriptionStatus,
                credits: {
                    available: userCredits.availableCredits,
                    lastReset: userCredits.lastReset
                }
            },
            token
        });
    } catch (error: any) {
        console.error('Erro ao registrar usuário:', error);
        return reply.code(500).send({ 
            success: false, 
            message: 'Erro ao registrar usuário', 
            error: error.message 
        });
    }
};

/**
 * Controlador para login/registro com Google
 */
export const googleLogin = async (req: FastifyRequest<{ Body: GoogleLoginRequest }>, reply: FastifyReply) => {
    try {
        const { email, name, googleId, photo } = req.body;

        // Usa a função createOrUpdateGoogleUser que já lida com a lógica de criar ou atualizar
        const user = await userRepository.createOrUpdateGoogleUser({
            name,
            email,
            googleId,
            photo
        });

        // Obtém o status da assinatura do usuário
        const subscriptionStatus = await getUserSubscriptionStatus(user.id);

        // Obtém os créditos disponíveis do usuário
        const userCredits = await creditsRepository.getUserCredits(user.id);

        // Gera o token JWT
        const token = gerarToken(user);

        // Retorna os dados do usuário e o token
        return reply.code(200).send({
            success: true,
            message: 'Login com Google realizado com sucesso',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                photo: user.photo,
                subscription: subscriptionStatus,
                credits: {
                    available: userCredits.availableCredits,
                    lastReset: userCredits.lastReset
                }
            },
            token
        });
    } catch (error: any) {
        console.error('Erro ao fazer login com Google:', error);
        return reply.code(500).send({ 
            success: false, 
            message: 'Erro ao fazer login com Google', 
            error: error.message 
        });
    }
};

/**
 * Controlador para gerar um token de teste
 * ATENÇÃO: Apenas para fins de teste, não use em produção
 */
export const getTestToken = async (req: FastifyRequest<{ Body: { userId?: number } }>, reply: FastifyReply) => {
  try {
    const { userId = 1 } = req.body;

    // Criar um usuário de teste
    const testUser = {
      id: userId,
      name: "Usuário de Teste",
      email: "teste@exemplo.com",
      username: "testuser",
    };

    // Gerar token JWT
    const token = gerarToken(testUser);

    // Retornar token
    return reply.code(200).send({
      success: true,
      message: "Token de teste gerado com sucesso",
      token
    });
  } catch (error: any) {
    console.error("Erro ao gerar token de teste:", error);
    return reply.code(500).send({
      success: false,
      message: "Erro ao gerar token de teste",
      error: error.message
    });
  }
}; 