# API de Gerenciamento de Usuários e Assinaturas

Esta API permite gerenciar usuários, autenticação, assinaturas, pagamentos e créditos para utilização de serviços de IA.

## Instalação

```bash
# Instalar dependências
npm install

# Configurar o banco de dados
npx prisma migrate dev

# Iniciar o servidor
npm run dev
```

O servidor rodará em http://localhost:3000.

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
DATABASE_URL="mysql://usuario:senha@localhost:3306/nome_do_banco"
JWT_SECRET="sua_chave_secreta_para_tokens"
```

## Rotas da API

### Autenticação

#### Registro de Usuário

```http
POST /auth/registro
Content-Type: application/json

{
  "nome": "Nome Completo",
  "email": "usuario@exemplo.com",
  "senha": "senha123",
  "photo": "https://exemplo.com/foto.jpg" // Opcional
}
```

Resposta:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Nome Completo",
    "email": "usuario@exemplo.com",
    "username": "Nome Completo",
    "photo": "https://exemplo.com/foto.jpg",
    "subscription": {
      "isPremium": false,
      "planType": "free"
    }
  },
  "token": "jwt_token_aqui"
}
```

#### Login com Email e Senha

```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "senha": "senha123"
}
```

Resposta:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Nome Completo",
    "email": "usuario@exemplo.com",
    "username": "Nome Completo",
    "photo": "https://exemplo.com/foto.jpg",
    "subscription": {
      "isPremium": false,
      "planType": "free",
      "expirationDate": null
    }
  },
  "token": "jwt_token_aqui"
}
```

#### Login com Google

```http
POST /auth/google
Content-Type: application/json

{
  "email": "usuario@gmail.com",
  "name": "Nome do Google",
  "googleId": "123456789",
  "photo": "https://lh3.googleusercontent.com/a/foto.jpg"
}
```

Resposta:
```json
{
  "success": true,
  "user": {
    "id": 2,
    "name": "Nome do Google",
    "email": "usuario@gmail.com",
    "username": "Nome do Google",
    "photo": "https://lh3.googleusercontent.com/a/foto.jpg",
    "subscription": {
      "isPremium": false,
      "planType": "free",
      "expirationDate": null
    }
  },
  "token": "jwt_token_aqui"
}
```

#### Token para testes (Não usar em produção)

```http
POST /auth/test-token
Content-Type: application/json

{
  "userId": 1 // Opcional
}
```

Resposta:
```json
{
  "success": true,
  "message": "Token de teste gerado com sucesso",
  "token": "jwt_token_aqui"
}
```

### Usuários

#### Criar Usuário

```http
POST /user
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "name": "Nome Completo",
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "username": "nomeusuario",
  "photo": "https://exemplo.com/foto.jpg" // Opcional
}
```

Resposta:
```json
{
  "id": 3,
  "name": "Nome Completo",
  "email": "usuario@exemplo.com",
  "username": "nomeusuario",
  "googleId": null,
  "photo": "https://exemplo.com/foto.jpg"
}
```

#### Buscar Usuário por ID

```http
GET /user/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "id": 1,
  "name": "Nome Completo",
  "email": "usuario@exemplo.com",
  "username": "nomeusuario",
  "googleId": null,
  "photo": "https://exemplo.com/foto.jpg"
}
```

#### Listar Todos os Usuários

```http
GET /users?offset=0&limit=10
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "users": [
    {
      "id": 1,
      "name": "Nome Completo",
      "email": "usuario@exemplo.com",
      "username": "nomeusuario",
      "googleId": null,
      "photo": "https://exemplo.com/foto.jpg"
    },
    // Outros usuários...
  ],
  "metadata": {
    "total": 50,
    "offset": 0,
    "limit": 10
  }
}
```

#### Atualizar Usuário

```http
PUT /user/1
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "name": "Novo Nome",
  "username": "novousername",
  "photo": "https://exemplo.com/nova-foto.jpg"
}
```

Resposta:
```json
{
  "message": "Usuário atualizado com sucesso",
  "user": {
    "id": 1,
    "name": "Novo Nome",
    "email": "usuario@exemplo.com",
    "username": "novousername",
    "googleId": null,
    "photo": "https://exemplo.com/nova-foto.jpg"
  }
}
```

#### Atualizar Foto do Usuário

```http
PUT /user/1/photo
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "photo": "https://exemplo.com/nova-foto.jpg"
}
```

Resposta:
```json
{
  "message": "Foto de perfil atualizada com sucesso",
  "user": {
    "id": 1,
    "name": "Nome Completo",
    "email": "usuario@exemplo.com",
    "username": "nomeusuario",
    "googleId": null,
    "photo": "https://exemplo.com/nova-foto.jpg"
  }
}
```

#### Excluir Usuário

```http
DELETE /user/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "message": "Usuário deletado com sucesso"
}
```

### Assinaturas

#### Criar Assinatura

```http
POST /subscription
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,
  "planType": "mensal", // "semanal", "mensal" ou "anual"
  "expirationDate": "2024-12-31T23:59:59Z"
}
```

Resposta:
```json
{
  "id": 1,
  "userId": 1,
  "planType": "mensal",
  "startDate": "2024-05-01T10:30:00.000Z",
  "expirationDate": "2024-12-31T23:59:59.000Z",
  "active": true,
  "paymentId": null,
  "createdAt": "2024-05-01T10:30:00.000Z",
  "updatedAt": "2024-05-01T10:30:00.000Z"
}
```

#### Buscar Assinatura por ID

```http
GET /subscription/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "id": 1,
  "userId": 1,
  "planType": "mensal",
  "startDate": "2024-05-01T10:30:00.000Z",
  "expirationDate": "2024-12-31T23:59:59.000Z",
  "active": true,
  "paymentId": null,
  "createdAt": "2024-05-01T10:30:00.000Z",
  "updatedAt": "2024-05-01T10:30:00.000Z"
}
```

#### Buscar Assinaturas do Usuário

```http
GET /subscription/user/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
[
  {
    "id": 1,
    "userId": 1,
    "planType": "mensal",
    "startDate": "2024-05-01T10:30:00.000Z",
    "expirationDate": "2024-12-31T23:59:59.000Z",
    "active": true,
    "paymentId": null,
    "createdAt": "2024-05-01T10:30:00.000Z",
    "updatedAt": "2024-05-01T10:30:00.000Z"
  }
]
```

#### Atualizar Assinatura

```http
PUT /subscription/1
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "active": false
}
```

Resposta:
```json
{
  "id": 1,
  "userId": 1,
  "planType": "mensal",
  "startDate": "2024-05-01T10:30:00.000Z",
  "expirationDate": "2024-12-31T23:59:59.000Z",
  "active": false,
  "paymentId": null,
  "createdAt": "2024-05-01T10:30:00.000Z",
  "updatedAt": "2024-05-01T15:45:00.000Z"
}
```

#### Excluir Assinatura

```http
DELETE /subscription/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "message": "Assinatura removida com sucesso"
}
```

### Pagamentos de Assinatura

#### Criar Pagamento PIX

```http
POST /subscription/payment/pix
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,
  "planType": "mensal", // "semanal", "mensal" ou "anual"
  "value": 29.90
}
```

Resposta:
```json
{
  "success": true,
  "message": "Pagamento PIX criado com sucesso",
  "payment": {
    "id": "pix_12345",
    "value": 29.90,
    "status": "pending",
    "qrCode": "00020101021226...",
    "qrCodeImage": "data:image/png;base64,...",
    "copyPaste": "00020101021226...",
    "expiresAt": "2024-05-01T11:30:00.000Z"
  },
  "subscription": {
    "id": 2,
    "userId": 1,
    "planType": "mensal",
    "startDate": "2024-05-01T10:45:00.000Z",
    "expirationDate": "2024-06-01T10:45:00.000Z",
    "active": false,
    "paymentId": "pix_12345",
    "createdAt": "2024-05-01T10:45:00.000Z",
    "updatedAt": "2024-05-01T10:45:00.000Z"
  }
}
```

#### Verificar Status do Pagamento

```http
POST /subscription/payment/check
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,
  "paymentId": "pix_12345"
}
```

Resposta:
```json
{
  "success": true,
  "message": "Pagamento processado com sucesso",
  "status": "approved",
  "subscription": {
    "id": 2,
    "userId": 1,
    "planType": "mensal",
    "startDate": "2024-05-01T10:45:00.000Z",
    "expirationDate": "2024-06-01T10:45:00.000Z",
    "active": true,
    "paymentId": "pix_12345",
    "createdAt": "2024-05-01T10:45:00.000Z",
    "updatedAt": "2024-05-01T10:50:00.000Z"
  }
}
```

### Créditos do Usuário

#### Obter Créditos do Usuário

```http
GET /credits/user/1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "id": 1,
  "userId": 1,
  "availableCredits": 20,
  "lastReset": "2024-05-01T00:00:00.000Z",
  "lastCheck": "2024-05-01T10:30:00.000Z",
  "createdAt": "2024-05-01T00:00:00.000Z",
  "updatedAt": "2024-05-01T10:30:00.000Z"
}
```

#### Verificar e Atualizar Créditos

```http
PUT /credits/check
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1
}
```

Resposta:
```json
{
  "credits": {
    "id": 1,
    "userId": 1,
    "availableCredits": 20,
    "lastReset": "2024-05-01T00:00:00.000Z",
    "lastCheck": "2024-05-01T15:45:00.000Z",
    "createdAt": "2024-05-01T00:00:00.000Z",
    "updatedAt": "2024-05-01T15:45:00.000Z"
  },
  "resetToday": false
}
```

#### Consumir Créditos

```http
PUT /credits/consume
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,
  "amount": 1
}
```

Resposta:
```json
{
  "success": true,
  "credits": {
    "id": 1,
    "userId": 1,
    "availableCredits": 19,
    "lastReset": "2024-05-01T00:00:00.000Z",
    "lastCheck": "2024-05-01T15:45:00.000Z",
    "createdAt": "2024-05-01T00:00:00.000Z",
    "updatedAt": "2024-05-01T15:50:00.000Z"
  }
}
```

### Serviços de IA

#### Listar Modelos Disponíveis

```http
GET /ai/models
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "success": true,
  "models": [
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "description": "Modelo rápido e eficiente para a maioria das tarefas"
    },
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "description": "Modelo mais avançado para tarefas complexas"
    }
  ]
}
```

#### Analisar Imagem

**Método POST (para requisições normais):**

```http
POST /ai/analyze-image
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,           // Opcional - Se não fornecido, não consome créditos
  "imageUrl": "https://exemplo.com/imagem.jpg",
  "prompt": "Descreva o que você vê nesta imagem",
  "model": "gpt-4-vision"  // Opcional
}
```

**Método GET (para streaming com EventSource):**

```http
GET /ai/analyze-image?userId=1&imageUrl=https://exemplo.com/imagem.jpg&prompt=Descreva%20o%20que%20voc%C3%AA%20v%C3%AA%20nesta%20imagem&model=gpt-4-vision
Authorization: Bearer jwt_token_aqui
```

Resposta (POST):
```json
{
  "success": true,
  "response": "A imagem mostra uma paisagem montanhosa com um lago cristalino no centro...",
  "creditsRemaining": 18
}
```

Resposta (GET): Stream de eventos SSE (Server-Sent Events)

#### Gerar Texto

**Método POST (para requisições normais):**

```http
POST /ai/generate-text
Content-Type: application/json
Authorization: Bearer jwt_token_aqui

{
  "userId": 1,           // Opcional - Se não fornecido, não consome créditos
  "prompt": "Escreva um artigo sobre inteligência artificial",
  "model": "gpt-4",      // Opcional
  "maxTokens": 1000,     // Opcional - Limite de tokens na resposta
  "temperature": 0.7     // Opcional - Controla a aleatoriedade (0.0 a 1.0)
}
```

**Método GET (para streaming com EventSource):**

```http
GET /ai/generate-text?userId=1&prompt=Escreva%20um%20artigo%20sobre%20intelig%C3%AAncia%20artificial&model=gpt-4&maxTokens=1000&temperature=0.7
Authorization: Bearer jwt_token_aqui
```

Resposta (POST):
```json
{
  "success": true,
  "response": "# Inteligência Artificial: O Futuro da Tecnologia\n\nA inteligência artificial (IA) tem revolucionado a forma como interagimos com a tecnologia...",
  "creditsRemaining": 17
}
```

Resposta (GET): Stream de eventos SSE (Server-Sent Events)

#### Interromper Geração em Andamento

```http
GET /ai/stop-generation?userId=1
Authorization: Bearer jwt_token_aqui
```

Resposta:
```json
{
  "success": true,
  "message": "Geração interrompida com sucesso"
}
```

## Observações Importantes

1. Todas as rotas, exceto as de autenticação, requerem o token JWT no cabeçalho `Authorization: Bearer token`.
2. Os usuários gratuitos recebem um número limitado de créditos diários para usar serviços de IA.
3. Os créditos são redefinidos diariamente às 00:00 UTC.
4. Usuários com assinaturas ativas têm acesso a diferentes limites de uso dependendo do plano.

## Tecnologias Utilizadas

- Node.js
- Fastify
- Prisma (ORM)
- MySQL
- JSON Web Tokens (JWT)
