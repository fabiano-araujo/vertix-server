import { FastifyRequest, FastifyReply } from 'fastify';
import * as subscriptionRepository from '../repositories/subscription.repository';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Carregar variáveis de ambiente
dotenv.config();

const prisma = new PrismaClient();

// Configurar SDK do Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-8728520231495724-040316-4879d0743caffb0b0d5dd636196d6349-186350723'
});
const payment = new Payment(client);

interface SubscriptionPaymentRequest {
  userId: number;
  planType: "semanal" | "mensal" | "anual";
}

// Interface para o webhook do Mercado Pago
interface MercadoPagoWebhook {
  action: string;
  data: {
    id: string | number;
  };
}

// Interface para o tipo correto do Fastify Request com o webhook do MP
interface WebhookRequest extends FastifyRequest {
  body: MercadoPagoWebhook;
}

/**
 * Calcula o valor da assinatura com base no tipo de plano
 */
const getPlanValue = (planType: string): number => {
  switch (planType) {
    case 'semanal':
      return 29.90;
    case 'mensal':
      return 99.90;
    case 'anual':
      return 999.00;
    default:
      return 99.90; // Valor padrão
  }
};

/**
 * Gera descrição amigável para o plano
 */
const getPlanDescription = (planType: string): string => {
  switch (planType) {
    case 'semanal':
      return 'Assinatura Semanal do Aplicativo';
    case 'mensal':
      return 'Assinatura Mensal do Aplicativo';
    case 'anual':
      return 'Assinatura Anual do Aplicativo';
    default:
      return 'Assinatura do Aplicativo';
  }
};

/**
 * Calcula a data de expiração correta com base no tipo de plano
 */
const calculateExpirationDate = (planType: string): Date => {
  const expirationDate = new Date();
  
  switch (planType) {
    case 'semanal':
      // 7 dias completos (168 horas)
      return new Date(expirationDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    case 'mensal':
      // Para plano mensal, usamos a mesma data do próximo mês
      // Exemplo: se hoje é 15/04, a expiração será 15/05
      const nextMonth = expirationDate.getMonth() + 1;
      const year = nextMonth === 12 ? expirationDate.getFullYear() + 1 : expirationDate.getFullYear();
      const month = nextMonth % 12;
      const newDate = new Date(year, month, expirationDate.getDate());
      
      // Se o dia do mês não existir no mês de expiração (ex: 31 de abril), 
      // ajustamos para o último dia do mês
      if (newDate.getMonth() !== month) {
        newDate.setDate(0); // Último dia do mês anterior
      }
      
      return newDate;
    case 'anual':
      // Para plano anual, usamos a mesma data do próximo ano
      const yearlyDate = new Date(expirationDate);
      yearlyDate.setFullYear(yearlyDate.getFullYear() + 1);
      return yearlyDate;
    default:
      throw new Error('Tipo de plano inválido');
  }
};

/**
 * Cancelar um pagamento no Mercado Pago
 */
const cancelPaymentInMercadoPago = async (paymentId: string): Promise<boolean> => {
  try {
    if (!paymentId) return false;
    
    let numericId: number;
    try {
      numericId = parseInt(paymentId);
      if (isNaN(numericId)) {
        console.log(`PaymentId inválido: ${paymentId}`);
        return false;
      }
    } catch (parseError) {
      console.error(`Erro ao converter paymentId para número: ${paymentId}`, parseError);
      return false;
    }
    
    // Verifica se o pagamento existe e pode ser cancelado
    try {
      const mpResponse = await payment.get({ id: numericId });
      
      // Se já estiver aprovado ou cancelado, não precisa fazer nada
      if (mpResponse.status === 'approved' || mpResponse.status === 'cancelled') {
        console.log(`Pagamento ${numericId} já está ${mpResponse.status}. Nenhuma ação necessária.`);
        return false;
      }
      
      // Cancelar pagamento
      console.log(`Cancelando pagamento ${numericId} no Mercado Pago`);
      await payment.cancel({ id: numericId });
      console.log(`Pagamento ${numericId} cancelado com sucesso.`);
      return true;
    } catch (error) {
      console.error(`Erro ao cancelar pagamento ${numericId}:`, error);
      return false;
    }
  } catch (error) {
    console.error('Erro ao cancelar pagamento no Mercado Pago:', error);
    return false;
  }
};

/**
 * Cria um pagamento para assinatura e retorna o QR code
 */
export const createSubscriptionPayment = async (req: FastifyRequest<{ Body: SubscriptionPaymentRequest }>, reply: FastifyReply) => {
  try {
    const { userId, planType } = req.body;

    // Validar dados
    if (!userId) {
      return reply.code(400).send({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    if (!planType || !['semanal', 'mensal', 'anual'].includes(planType)) {
      return reply.code(400).send({
        success: false,
        message: 'Tipo de plano inválido. Deve ser semanal, mensal ou anual'
      });
    }

    // Verificar se o usuário já tem uma assinatura pendente
    const pendingSubscriptions = await subscriptionRepository.findPendingSubscriptionsByUserId(userId);
    
    // Se houver assinaturas pendentes, cancelar todas no Mercado Pago
    if (pendingSubscriptions.length > 0) {
      console.log(`Encontradas ${pendingSubscriptions.length} assinaturas pendentes para o usuário ${userId}. Cancelando...`);
      
      for (const subscription of pendingSubscriptions) {
        if (subscription.paymentId) {
          // Cancelar no Mercado Pago
          await cancelPaymentInMercadoPago(subscription.paymentId);
        }
        
        // Excluir a assinatura do banco de dados
        try {
          await prisma.subscription.delete({
            where: { id: subscription.id }
          });
          console.log(`Assinatura ${subscription.id} excluída do banco de dados.`);
        } catch (deleteError) {
          console.error(`Erro ao excluir assinatura ${subscription.id}:`, deleteError);
        }
      }
      
      console.log(`${pendingSubscriptions.length} assinaturas pendentes foram processadas.`);
    }

    // Gerar referência única para o pagamento
    const paymentReference = `${userId}_${planType}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Obter valor do plano
    const planValue = getPlanValue(planType);
    const planDescription = getPlanDescription(planType);

    // Calcular uma expiração temporária (24 horas para o pagamento)
    const paymentExpirationDate = new Date(Date.now() + (24 * 60 * 60 * 1000));

    // Criar um registro de assinatura pendente usando o repositório
    const newSubscription = await subscriptionRepository.createSubscription({
      userId,
      planType,
      expirationDate: paymentExpirationDate, // 24 horas para realizar o pagamento
      paymentId: paymentReference
    });

    // Preparar dados para o Mercado Pago
    const payment_data = {
      transaction_amount: planValue,
      description: planDescription,
      payment_method_id: "pix",
      date_of_expiration: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // 24 horas
      // Comentado temporariamente para evitar o erro "notificaction_url attribute must be url valid"
      // notification_url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/webhook/mercadopago`,
      metadata: {
        userId,
        planType,
        subscriptionId: newSubscription.id,
        paymentReference
      },
      payer: {
        email: "comprador@email.com", // Pode ser substituído pelo email real do usuário
        first_name: "Usuário",
        last_name: "App",
        identification: {
          type: "CPF",
          number: "00000000000"
        },
      }
    };

    console.log('Enviando requisição para Mercado Pago:', JSON.stringify(payment_data));

    // Fazer a requisição para o Mercado Pago
    const mpResponse = await payment.create({ body: payment_data });

    console.log('Resposta recebida do Mercado Pago:', JSON.stringify(mpResponse));

    // Atualizar a assinatura pendente com ID do pagamento do Mercado Pago
    await subscriptionRepository.updateSubscription(
      newSubscription.id,
      {
        paymentId: mpResponse.id?.toString() || paymentReference
      }
    );

    // Retornar dados para o frontend
    return reply.code(201).send({
      success: true,
      data: {
        subscriptionId: newSubscription.id,
        paymentId: mpResponse.id?.toString(),
        status: "PENDING",
        value: planValue,
        planType,
        expiresIn: 24 * 60 * 60, // 24 horas em segundos
        qrCode: {
          image: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 || "",
          copyPaste: mpResponse.point_of_interaction?.transaction_data?.qr_code || ""
        }
      },
      message: `Código QR gerado para assinatura ${planType}. Válido por 24 horas.`
    });

  } catch (error: any) {
    console.error('Erro ao criar pagamento de assinatura:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao criar pagamento de assinatura',
      error: error.message
    });
  }
};

/**
 * Verifica o status do pagamento de assinatura
 */
export const checkSubscriptionPaymentStatus = async (req: FastifyRequest<{ Params: { paymentId: string } }>, reply: FastifyReply) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return reply.code(400).send({
        success: false,
        message: 'ID do pagamento é obrigatório'
      });
    }

    // Buscar assinatura pelo paymentId
    const subscription = await subscriptionRepository.findSubscriptionByPaymentId(paymentId);

    if (!subscription) {
      return reply.code(404).send({
        success: false,
        message: 'Pagamento de assinatura não encontrado'
      });
    }

    // Verificar status no Mercado Pago se o pagamento não estiver ativo
    if (!subscription.active) {
      try {
        console.log(`Tentando verificar pagamento no Mercado Pago com ID: ${paymentId}`);
        
        // Verificar se o paymentId é um número válido
        let numericId: number;
        try {
          numericId = parseInt(paymentId);
          if (isNaN(numericId)) {
            throw new Error('PaymentId não é um número válido');
          }
        } catch (parseError) {
          console.error('Erro ao converter paymentId para número:', parseError);
          throw new Error('Formato de ID de pagamento inválido');
        }
        
        // Continuar com a requisição para o Mercado Pago
        const mpResponse = await payment.get({ id: numericId });
        
        console.log('Status do pagamento no Mercado Pago:', mpResponse.status);
        
        // Se o pagamento foi aprovado, ativar a assinatura
        if (mpResponse.status === 'approved') {
          // Calcular data de expiração
          const expirationDate = calculateExpirationDate(subscription.planType);
          
          // Atualizar assinatura para ativa
          await subscriptionRepository.updateSubscription(
            subscription.id,
            {
              active: true,
              expirationDate,
              updatedAt: new Date()
            }
          );
          
          subscription.active = true;
          subscription.expirationDate = expirationDate;
        }
      } catch (mpError) {
        console.error('Erro ao verificar status no Mercado Pago:', mpError);
        // Continuar com os dados do banco mesmo com erro no MP
      }
    }

    // Preparar resposta
    return reply.code(200).send({
      success: true,
      data: {
        subscriptionId: subscription.id,
        paymentId: subscription.paymentId || '',
        status: subscription.active ? "ACTIVE" : "PENDING",
        planType: subscription.planType || '',
        expirationDate: subscription.expirationDate || new Date(),
        active: Boolean(subscription.active),
        isPremium: Boolean(subscription.active),
        formattedExpirationDate: subscription.expirationDate ? 
          subscription.expirationDate.toLocaleDateString() : 'Não definida',
        remainingDays: subscription.active && subscription.expirationDate ? 
          Math.max(0, Math.ceil((subscription.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
      },
      message: subscription.active && subscription.expirationDate
        ? `Assinatura ativa até ${subscription.expirationDate.toLocaleDateString()}` 
        : 'Aguardando confirmação do pagamento'
    });

  } catch (error: any) {
    console.error('Erro ao verificar status de pagamento:', error);
    
    return reply.code(500).send({
      success: false,
      message: 'Erro ao verificar status de pagamento',
      error: error.message
    });
  }
};

/**
 * Webhook para receber notificações de pagamento do Mercado Pago
 */
export const mercadoPagoWebhook = async (req: WebhookRequest, reply: FastifyReply) => {
  try {
    console.log('Webhook do Mercado Pago recebido:', req.body);
    
    // Agora req.body já está tipado como MercadoPagoWebhook
    const { action, data } = req.body;
    
    if (!action || !data || !data.id) {
      console.log('Webhook sem dados necessários. Ignorando.');
      return reply.code(200).send({ success: true });
    }
    
    // Apenas processar eventos de pagamento
    if (action === 'payment.updated' || action === 'payment.created') {
      const paymentId = data.id;
      
      // Obter dados do pagamento
      const mpResponse = await payment.get({ id: typeof paymentId === 'string' ? parseInt(paymentId) : paymentId });
      
      // Se o pagamento foi aprovado, atualizar a assinatura
      if (mpResponse.status === 'approved') {
        // Buscar assinatura pelo paymentId
        const subscription = await subscriptionRepository.findSubscriptionByPaymentId(paymentId.toString());
        
        if (subscription && !subscription.active) {
          // Calcular data de expiração
          const expirationDate = calculateExpirationDate(subscription.planType);
          
          // Atualizar assinatura para ativa
          await subscriptionRepository.updateSubscription(
            subscription.id,
            {
              active: true,
              expirationDate,
              updatedAt: new Date()
            }
          );
          
          console.log(`Assinatura ${subscription.id} ativada com sucesso.`);
        }
      }
    }
    
    // Sempre retornar sucesso para o webhook (requerido pelo Mercado Pago)
    return reply.code(200).send({ success: true });
    
  } catch (error: any) {
    console.error('Erro ao processar webhook do Mercado Pago:', error);
    
    // Mesmo com erro, retornar 200 para não repetir notificações
    return reply.code(200).send({ 
      success: true,
      message: 'Erro processado, mas não repetir webhook'
    });
  }
};

/**
 * Verifica o status de pagamentos pendentes de um usuário
 * Esta função é utilizada quando o usuário faz login
 * Ela verifica se há pagamentos aprovados no Mercado Pago e atualiza as assinaturas,
 * ou cancela e exclui assinaturas pendentes antigas
 */
export const checkPendingPaymentsForUser = async (userId: number): Promise<boolean> => {
  try {
    // Buscar assinaturas pendentes do usuário
    const pendingSubscriptions = await subscriptionRepository.findPendingSubscriptionsByUserId(userId);
    
    if (pendingSubscriptions.length === 0) {
      console.log(`Nenhum pagamento pendente encontrado para o usuário ${userId}`);
      return false;
    }
    
    console.log(`Encontrados ${pendingSubscriptions.length} pagamentos pendentes para o usuário ${userId}`);
    let updated = false;
    
    // Verificar cada assinatura pendente
    for (const subscription of pendingSubscriptions) {
      // Se não houver paymentId, não há como verificar - exclui direto
      if (!subscription.paymentId) {
        await prisma.subscription.delete({
          where: { id: subscription.id }
        });
        console.log(`Assinatura ${subscription.id} sem paymentId excluída.`);
        continue;
      }
      
      try {
        // Verificar se o paymentId é um número válido
        const paymentId = subscription.paymentId;
        let numericId: number;
        
        try {
          numericId = parseInt(paymentId);
          if (isNaN(numericId)) {
            console.log(`PaymentId inválido para assinatura ${subscription.id}: ${paymentId}. Excluindo...`);
            await prisma.subscription.delete({
              where: { id: subscription.id }
            });
            continue;
          }
        } catch (parseError) {
          console.error(`Erro ao converter paymentId para número: ${paymentId}. Excluindo assinatura...`);
          await prisma.subscription.delete({
            where: { id: subscription.id }
          });
          continue;
        }
        
        // Consultar status no Mercado Pago
        console.log(`Verificando pagamento ${numericId} para a assinatura ${subscription.id}`);
        const mpResponse = await payment.get({ id: numericId });
        
        // Se o pagamento foi aprovado, ativar a assinatura
        if (mpResponse.status === 'approved') {
          console.log(`Pagamento ${numericId} aprovado. Atualizando assinatura ${subscription.id}`);
          
          // Calcular data de expiração
          const expirationDate = calculateExpirationDate(subscription.planType);
          
          // Atualizar assinatura para ativa
          await subscriptionRepository.updateSubscription(
            subscription.id,
            {
              active: true,
              expirationDate,
              updatedAt: new Date()
            }
          );
          
          updated = true;
          console.log(`Assinatura ${subscription.id} ativada com sucesso.`);
        } else if (mpResponse.status === 'rejected' || mpResponse.status === 'cancelled') {
          // Se o pagamento foi rejeitado ou cancelado, excluir a assinatura
          console.log(`Pagamento ${numericId} com status: ${mpResponse.status}. Excluindo assinatura...`);
          await prisma.subscription.delete({
            where: { id: subscription.id }
          });
        } else {
          console.log(`Pagamento ${numericId} com status: ${mpResponse.status}. Mantendo assinatura pendente.`);
        }
      } catch (mpError) {
        console.error(`Erro ao verificar pagamento para assinatura ${subscription.id}:`, mpError);
        // Em caso de erro, exclui a assinatura para evitar acúmulo de registros problemáticos
        try {
          await prisma.subscription.delete({
            where: { id: subscription.id }
          });
          console.log(`Assinatura ${subscription.id} excluída devido a erro na verificação.`);
        } catch (deleteError) {
          console.error(`Erro ao excluir assinatura com erro de verificação:`, deleteError);
        }
      }
    }
    
    return updated;
  } catch (error) {
    console.error('Erro ao verificar pagamentos pendentes do usuário:', error);
    return false;
  }
}; 