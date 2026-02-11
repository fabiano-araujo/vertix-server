import User from './user.types';

/**
 * Modelo para créditos diários do usuário
 */
export class UserCredits {
  id: number;
  userId: number;
  availableCredits: number;
  lastReset: Date;
  lastCheck: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: User;

  constructor(
    id: number,
    userId: number,
    availableCredits: number = 20,
    lastReset: Date = new Date(),
    lastCheck: Date = new Date(),
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
    user?: User
  ) {
    this.id = id;
    this.userId = userId;
    this.availableCredits = availableCredits;
    this.lastReset = lastReset;
    this.lastCheck = lastCheck;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.user = user;
  }

  /**
   * Verifica se é necessário reiniciar os créditos diários
   * @returns boolean indicando se os créditos foram reiniciados
   */
  shouldResetCredits(): boolean {
    // Verifica se a data da última reinicialização é de um dia anterior
    const today = new Date();
    const lastResetDate = new Date(this.lastReset);
    
    return (
      today.getDate() !== lastResetDate.getDate() ||
      today.getMonth() !== lastResetDate.getMonth() ||
      today.getFullYear() !== lastResetDate.getFullYear()
    );
  }

  /**
   * Obtém o limite de créditos com base no tipo de assinatura
   * @returns número de créditos para o tipo de assinatura
   */
  getCreditsLimit(isPremium: boolean): number {
    return isPremium ? 200 : 20;
  }

  /**
   * Reinicia os créditos diários do usuário
   * @param isPremium indica se o usuário é premium ou não
   */
  resetCredits(isPremium: boolean): void {
    this.availableCredits = this.getCreditsLimit(isPremium);
    this.lastReset = new Date();
  }

  /**
   * Consome créditos do usuário
   * @param amount quantidade de créditos a serem consumidos
   * @returns boolean indicando se os créditos foram consumidos com sucesso
   */
  consumeCredits(amount: number): boolean {
    if (this.availableCredits >= amount) {
      this.availableCredits -= amount;
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Atualiza a data da última verificação
   */
  updateLastCheck(): void {
    this.lastCheck = new Date();
    this.updatedAt = new Date();
  }
}

/**
 * Modelo para cr��ditos vinculados a dispositivo
 */
export class DeviceCredits {
  id: number;
  deviceId: string;
  availableCredits: number;
  lastReset: Date;
  lastCheck: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: number,
    deviceId: string,
    availableCredits: number = 100,
    lastReset: Date = new Date(),
    lastCheck: Date = new Date(),
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this.id = id;
    this.deviceId = deviceId;
    this.availableCredits = availableCredits;
    this.lastReset = lastReset;
    this.lastCheck = lastCheck;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  shouldResetCredits(): boolean {
    const today = new Date();
    const lastResetDate = new Date(this.lastReset);

    return (
      today.getDate() !== lastResetDate.getDate() ||
      today.getMonth() !== lastResetDate.getMonth() ||
      today.getFullYear() !== lastResetDate.getFullYear()
    );
  }

  resetCredits(defaultLimit: number = 100): void {
    this.availableCredits = defaultLimit;
    this.lastReset = new Date();
    this.updatedAt = new Date();
  }

  consumeCredits(amount: number): boolean {
    if (this.availableCredits >= amount) {
      this.availableCredits -= amount;
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  addCredits(amount: number, maxLimit: number = 100): void {
    this.availableCredits = Math.min(this.availableCredits + amount, maxLimit);
    this.updatedAt = new Date();
  }

  updateLastCheck(): void {
    this.lastCheck = new Date();
    this.updatedAt = new Date();
  }
}
