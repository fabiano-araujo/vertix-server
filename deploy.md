# Deploy do Vertix API

## Conexão SSH

**Chave:** `C:\Users\Fabiano\Documents\server_oracle\music_service.ppk`

**Servidor:** `root@46.202.89.177`

**Pasta API:** `/var/vertix`

**Porta:** `3005`

---

## Primeiro Deploy (Setup inicial)

### 1. Push local
```bash
cd server
git add . && git commit -m "Setup deploy" && git push
```

### 2. Conectar via SSH e configurar servidor
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177
```

### 3. No servidor, executar:
```bash
# Clonar repositório
cd /var
git clone https://github.com/SEU_USUARIO/vertix.git
cd vertix/server

# Instalar dependências
yarn install

# Configurar .env (criar arquivo com as variáveis necessárias)
nano .env

# Gerar Prisma Client e rodar migrations
npx prisma generate
npx prisma migrate deploy

# Build do projeto
yarn build

# Iniciar com PM2
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save
```

---

## Comandos de Deploy (após setup)

### 1. Push local (SEMPRE fazer antes do deploy)
```bash
cd server
git add . && git commit -m "Descrição das mudanças" && git push
```

### 2. Deploy completo
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "cd /var/vertix/server && git reset --hard origin/main && git pull && yarn install && npx prisma generate && yarn build && pm2 restart vertix"
```

### Deploy rápido (sem dependências)
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "cd /var/vertix/server && git pull && yarn build && pm2 restart vertix"
```

### Apenas reiniciar serviço
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "pm2 restart vertix"
```

### Ver logs
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "pm2 logs vertix --lines 50"
```

### Ver logs em tempo real (conectar SSH primeiro)
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177
pm2 logs vertix
```

### Status do serviço
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "pm2 status"
```

### Rodar migrations (quando houver mudanças no schema)
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\music_service.ppk" root@46.202.89.177 "cd /var/vertix/server && npx prisma migrate deploy && pm2 restart vertix"
```
