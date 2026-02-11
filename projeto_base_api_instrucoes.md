# Documentação da API Telegram

Este documento contém instruções e informações sobre a API Telegram que você está usando. A API permite autenticar no Telegram, obter diálogos, mensagens e gerenciar assinaturas premium.

## Importando o Workspace no Insomnia

1. Abra o Insomnia
2. Clique em "Application" (canto superior esquerdo) -> "Preferences" -> "Data" -> "Import Data" -> "From File"
3. Selecione o arquivo `insomnia_telegram_api.json`
4. Após importar, você verá o workspace "API Telegram" com todas as requisições configuradas

## Configuração do Ambiente

O workspace já vem configurado com as variáveis de ambiente necessárias:

- `base_url`: URL base da API (por padrão: http://localhost:3000)

Você pode alterar essas variáveis de acordo com o seu ambiente.

## Autenticação no Telegram

A autenticação no Telegram é feita em duas etapas:

1. **Iniciar Autenticação**: Envia um código para o número de telefone fornecido
2. **Completar Autenticação**: Utiliza o código recebido para completar o processo de autenticação

### Iniciar Autenticação

Requisição: "Iniciar Autenticação"
- Substitua o número de telefone no corpo da requisição pelo seu número
- O formato deve ser: +XXXXXXXXXXXX (incluindo o código do país)
- Após enviar, você receberá um código no Telegram que será usado na próxima etapa

### Completar Autenticação

Requisição: "Completar Autenticação"
- O código fornecido pelo Telegram deve ser inserido no campo `code`
- O `phoneCodeHash` será automaticamente preenchido com a resposta da etapa anterior
- O resultado da autenticação incluirá um `sessionString` que será usado nas requisições seguintes

## Endpoints de Mensagens

Os endpoints de mensagens permitem obter diálogos e mensagens do Telegram.

### Obter Diálogos/Grupos

Requisição: "Obter Diálogos/Grupos"
- Retorna a lista de diálogos (chats, grupos, canais) do usuário
- Você pode especificar um `limit` para limitar o número de resultados

### Obter Mensagens do Grupo

Requisição: "Obter Mensagens do Grupo"
- Substitua `username_ou_id_do_grupo` pelo ID do grupo ou nome de usuário
- Suporta paginação através dos parâmetros `limit` e `page`

### Obter Próxima Página de Mensagens

Requisição: "Obter Próxima Página de Mensagens"
- Demonstra como avançar para a próxima página de mensagens
- Incrementa o valor de `page` para obter a próxima página

### Obter Mensagens por OffsetId

Requisição: "Obter Mensagens por OffsetId"
- Utiliza o offsetId da resposta anterior para obter mensagens mais antigas
- Mais preciso que a paginação por página para chats com atividade frequente

## Endpoints de Usuários

Esses endpoints permitem gerenciar usuários da sua aplicação.

### Registro de Usuário

Requisição: "Registrar Usuário"
- Cria um novo usuário no sistema
- Retorna um token JWT para autenticação

### Login de Usuário

Requisição: "Login de Usuário"
- Autentica um usuário existente
- Retorna um token JWT para ser usado nas requisições seguintes

### Obter Perfil do Usuário

Requisição: "Obter Perfil"
- Retorna os dados do usuário autenticado
- Requer o token JWT de autenticação

## Sistema de Assinaturas Premium

A API inclui um sistema completo de assinaturas premium com diferentes planos e pagamento via Pix.

### Verificar Status de Assinatura

Requisição: "Verificar Status de Assinatura"
- Verifica se o usuário atual possui uma assinatura premium ativa
- Retorna detalhes como tipo de plano e data de expiração

### Obter Configuração de Assinatura

Requisição: "Obter Configuração de Assinatura"
- Fornece informações detalhadas sobre a assinatura do usuário
- Inclui data de expiração formatada e número de dias restantes

### Criar Pagamento de Assinatura

Requisições: 
- "Criar Pagamento de Assinatura" (mensal - R$99,90)
- "Criar Pagamento de Assinatura Semanal" (R$29,90)
- "Criar Pagamento de Assinatura Anual" (R$999,00)

Estas requisições criam um novo pagamento para o plano selecionado e retornam:
- QR Code do Pix (imagem em base64)
- Código "copia e cola" do Pix
- ID do pagamento para verificação posterior

### Verificar Status do Pagamento

Requisição: "Verificar Status do Pagamento"
- Verifica se um pagamento específico foi confirmado
- Usa o ID de pagamento retornado pela requisição de criação
- Quando o pagamento é confirmado, a assinatura é automaticamente ativada

## Dicas de Uso

1. Primeiro faça o registro ou login para obter um token JWT
2. Use o token JWT nas requisições subsequentes
3. Para utilizar o Telegram, realize a autenticação em duas etapas
4. O `sessionString` obtido na autenticação do Telegram deve ser incluído nas requisições de mensagens
5. Para adquirir uma assinatura premium:
   - Escolha um plano (semanal, mensal ou anual)
   - Crie um pagamento e utilize o QR Code Pix gerado
   - Verifique o status do pagamento após realizar o pagamento
   - Quando confirmado, a assinatura será ativada automaticamente

## Tratamento de Erros

A API retorna códigos de status HTTP padrão:

- 200: Sucesso
- 400: Erro na requisição (verifique os parâmetros enviados)
- 401: Não autorizado (token inválido ou expirado)
- 404: Recurso não encontrado
- 500: Erro interno do servidor

As respostas de erro incluem um objeto JSON com a propriedade `message` contendo detalhes sobre o erro. 