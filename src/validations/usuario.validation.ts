import * as yup from "yup";

// Validação para criação de usuário normal
export const usuarioValidation = yup.object({
    nome: yup.string().required('Nome é obrigatório'),
    email: yup.string().required('Email é obrigatório').email('Email inválido'),
    senha: yup.string().required('Senha é obrigatória').min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

// Validação para login
export const loginValidation = yup.object({
    email: yup.string().required('Email é obrigatório').email('Email inválido'),
    senha: yup.string().required('Senha é obrigatória'),
});

// Validação para login com Google
export const googleLoginValidation = yup.object({
    email: yup.string().required('Email é obrigatório').email('Email inválido'),
    name: yup.string().required('Nome é obrigatório'),
    googleId: yup.string().required('ID do Google é obrigatório'),
    picture: yup.string(),
});