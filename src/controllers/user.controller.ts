import { FastifyRequest, FastifyReply } from "fastify";
import * as userRepository from '../repositories/user.repository';
import * as subscriptionRepository from '../repositories/subscription.repository';
import * as creditsRepository from '../repositories/credits.repository';
import User from '../models/user.types';
import { number } from "yup";

export const createUser = async (req: FastifyRequest<{ Body: User }>, reply: FastifyReply) => {
    try {
        console.log(req.body);
        const user = await userRepository.createUser(req.body);
        reply.code(200).send(user);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao criar usuário' });
    }
};

export const findUserById = async (req: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
        const user = await userRepository.findUserById(Number(req.params.id));
        if (!user) {
            return reply.code(404).send({ message: 'Usuário não encontrado' });
        }
        
        // Obter status da assinatura do usuário
        const subscriptionStatus = await subscriptionRepository.getUserPlanType(user.id);
        
        // Obter créditos do usuário
        const userCredits = await creditsRepository.getUserCredits(user.id);
        
        // Retornar no formato solicitado
        return reply.code(200).send({
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
        });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar usuário' });
    }
};

export const findAllUsers = async (req: FastifyRequest<{ Querystring: { offset?: number, limit?: number } }>, reply: FastifyReply) => {
    const { offset = 0, limit = 10 } = req.query;
    try {
        const users = await userRepository.findAllUsers(offset, limit);
        reply.send(users);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar usuários' });
    }
};

export const deleteUser = async (req: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    try {
        const user = await userRepository.deleteUser(Number(req.params.id));
        if (!user) {
            return reply.code(404).send({ message: 'Usuário não encontrado' });
        }
        reply.send({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao deletar usuário' });
    }
};

export const updateUserPhoto = async (req: FastifyRequest<{ 
    Params: { id: number }, 
    Body: { photo: string } 
}>, reply: FastifyReply) => {
    try {
        // Verificar se o usuário existe
        const userExists = await userRepository.findUserById(Number(req.params.id));
        if (!userExists) {
            return reply.code(404).send({ message: 'Usuário não encontrado' });
        }

        // Atualizar apenas a foto do usuário
        const updatedUser = await userRepository.updateUser(Number(req.params.id), {
            photo: req.body.photo
        });

        reply.code(200).send({
            message: 'Foto de perfil atualizada com sucesso',
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao atualizar foto do usuário' });
    }
};

export const updateUser = async (req: FastifyRequest<{ 
    Params: { id: number }, 
    Body: { name?: string, username?: string, photo?: string } 
}>, reply: FastifyReply) => {
    try {
        // Verificar se o usuário existe
        const userExists = await userRepository.findUserById(Number(req.params.id));
        if (!userExists) {
            return reply.code(404).send({ message: 'Usuário não encontrado' });
        }

        // Atualizar os dados do usuário
        const updatedUser = await userRepository.updateUser(Number(req.params.id), req.body);

        reply.code(200).send({
            message: 'Usuário atualizado com sucesso',
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao atualizar usuário' });
    }
};
