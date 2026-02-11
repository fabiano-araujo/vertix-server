class User {
  id: number;
  name: string;               // Nome completo do usuário
  email: string;              // Email do usuário
  password?: string;          // Senha (opcional para login com Google)
  googleId?: string;          // ID do usuário no Google
  username?: string;          // Nome de usuário (pode ser usado para exibição)
  photo?: string;             // URL ou caminho da foto do perfil do usuário
  subscriptions?: Subscription[]; // Relacionamento com assinaturas
  credits?: any;              // Relacionamento com créditos (definido como any para evitar referência circular)
  isPremium?: () => boolean;  // Método para verificar se o usuário é premium (opcional)

  constructor(
    id: number, 
    name: string, 
    email: string, 
    password?: string,
    googleId?: string,
    username?: string,
    photo?: string,
    subscriptions?: Subscription[],
    credits?: any
  ) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.googleId = googleId;
    this.username = username || name; // Se username não for fornecido, usa o nome
    this.photo = photo;
    this.subscriptions = subscriptions;
    this.credits = credits;
    
    // Define o método isPremium apenas se houver subscriptions
    if (subscriptions) {
      this.isPremium = () => {
        if (!this.subscriptions || this.subscriptions.length === 0) {
          return false;
        }
        
        // Verifica se existe alguma assinatura ativa
        return this.subscriptions.some(subscription => subscription.isActive());
      };
    }
  }
}

// Modelo de assinatura
export class Subscription {
  id: number;
  userId: number;
  planType: "semanal" | "mensal" | "anual";
  startDate: Date;
  expirationDate: Date;
  active: boolean;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: number,
    userId: number,
    planType: "semanal" | "mensal" | "anual",
    expirationDate: Date,
    startDate: Date = new Date(),
    active: boolean = true,
    paymentId?: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this.id = id;
    this.userId = userId;
    this.planType = planType;
    this.startDate = startDate;
    this.expirationDate = expirationDate;
    this.active = active;
    this.paymentId = paymentId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // Método para verificar se a assinatura está ativa
  isActive(): boolean {
    return this.active && this.expirationDate > new Date();
  }

  // Método para obter o tipo de plano atual
  getPlanType(): string {
    return this.isActive() ? this.planType : "free";
  }
}

export default User;
