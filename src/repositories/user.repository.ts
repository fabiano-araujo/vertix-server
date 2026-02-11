import { PrismaClient } from '@prisma/client';
import User from '../models/user.types';
import { criptografarSenha } from '../helpers/auth.helper';

const prisma = new PrismaClient();

export const createUser = async (data: User) => {
    // Verifica se já existe um usuário com este email
    const userExists = await findUserByEmail(data.email);
    if (userExists) {
        throw new Error('Este email já está em uso');
    }

    // Se a senha foi fornecida, criptografa-a
    let hashedPassword: string | null = null;
    if (data.password) {
        hashedPassword = await criptografarSenha(data.password);
    }

    return await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            googleId: data.googleId,
            username: data.username || data.name,
            photo: data.photo,
        },
    });
};

export const createOrUpdateGoogleUser = async (data: {
    name: string,
    email: string,
    googleId: string,
    photo?: string
}) => {
    // Verifica se o usuário já existe pelo GoogleId
    let user = await findUserByGoogleId(data.googleId);
    
    // Se não encontrou pelo GoogleId, tenta pelo email
    if (!user) {
        user = await findUserByEmail(data.email);
    }
    
    // Se já existe, atualiza os dados
    if (user) {
        return await prisma.user.update({
            where: { id: user.id },
            data: {
                name: data.name,
                googleId: data.googleId,
                photo: data.photo,
            },
        });
    }
    
    // Se não existe, cria um novo usuário
    return await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            googleId: data.googleId,
            username: data.name,
            photo: data.photo,
        },
    });
};

export const findUserById = async (id: number, includeSubscriptions: boolean = false) => {
    if (includeSubscriptions) {
        return await prisma.user.findUnique({
            where: { id },
            include: {
                subscriptions: true,
            }
        });
    } else {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                googleId: true,
                photo: true,
            }
        });
    }
};

export const findUserByName = async (name: string, includeSubscriptions: boolean = false) => {
    if (includeSubscriptions) {
        return await prisma.user.findFirst({
            where: { name },
            include: {
                subscriptions: true,
            }
        });
    } else {
        return await prisma.user.findFirst({
            where: { name },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                googleId: true,
                photo: true,
            }
        });
    }
};

export const findUserByEmail = async (email: string, includeSubscriptions: boolean = false) => {
    if (includeSubscriptions) {
        return await prisma.user.findUnique({
            where: { email },
            include: {
                subscriptions: true,
            }
        });
    } else {
        return await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                password: true,
                googleId: true,
                photo: true,
            }
        });
    }
};

export const findUserByGoogleId = async (googleId: string, includeSubscriptions: boolean = false) => {
    if (includeSubscriptions) {
        return await prisma.user.findUnique({
            where: { googleId },
            include: {
                subscriptions: true,
            }
        });
    } else {
        return await prisma.user.findUnique({
            where: { googleId },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                googleId: true,
                photo: true,
            }
        });
    }
};

export const findAllUsers = async (offset: number = 0, limit: number = 10, includeSubscriptions: boolean = false) => {
    let users;
    
    if (includeSubscriptions) {
        users = await prisma.user.findMany({
            skip: offset,
            take: limit,
            include: {
                subscriptions: true,
            }
        });
    } else {
        users = await prisma.user.findMany({
            skip: offset,
            take: limit,
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                googleId: true,
                photo: true,
            }
        });
    }
    
    const total = await prisma.user.count();
    
    return {
        users,
        metadata: {
            total,
            offset,
            limit
        }
    };
};

export const updateUser = async (id: number, data: { name?: string, username?: string, photo?: string }) => {
    return await prisma.user.update({
        where: { id },
        data: {
            ...data, // Atualiza apenas os campos fornecidos
        },
    });
};

export const deleteUser = async (id: number) => {
    const userExists = await findUserById(id);
    if (!userExists) {
        return null;
    }
    
    // Primeiro apagar todas as assinaturas do usuário
    await prisma.subscription.deleteMany({
        where: { userId: id },
    });
    
    return await prisma.user.delete({
        where: { id },
    });
};
