import * as userController from '../controllers/user.controller';

const userRoutes = (app: any) => {
    app.post("/user", userController.createUser);            // Rota para criar um novo usuário
    app.get("/user/:id", userController.findUserById);       // Rota para buscar um usuário pelo ID
    app.get("/users", userController.findAllUsers);           // Rota para buscar todos os usuários, com suporte a paginação
    app.put("/user/:id", userController.updateUser);         // Rota para atualizar informações gerais do usuário
    app.put("/user/:id/photo", userController.updateUserPhoto); // Rota para atualizar apenas a foto do usuário
    app.delete("/user/:id", userController.deleteUser);      // Rota para deletar um usuário pelo ID
};

export default userRoutes;
