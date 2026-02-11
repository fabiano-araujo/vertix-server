import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/user.types';

/**
 * Gera um token JWT para o usuário autenticado
 * @param user Objeto do usuário
 * @returns Token JWT
 */
export const gerarToken = (user: any) => {
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            nome: user.username || user.name
        },
        String(process.env.TOKEN_KEY)
    );
    return token;
};

/**
 * Criptografa a senha do usuário
 * @param senha Senha em texto puro
 * @returns Senha criptografada
 */
export const criptografarSenha = async (senha: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(senha, salt);
};

/**
 * Verifica se a senha fornecida corresponde à senha criptografada
 * @param senha Senha em texto puro
 * @param senhaCriptografada Senha criptografada
 * @returns Verdadeiro se as senhas correspondem
 */
export const verificarSenha = async (senha: string, senhaCriptografada: string): Promise<boolean> => {
    return await bcrypt.compare(senha, senhaCriptografada);
}; 