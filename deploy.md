# Deploy do Vertix API

Este é o único deploy acionado por `deploy` / `deploy do servidor` neste workspace: o Node.js em `server/`. Não é a Music API, nem o app Flutter.

**Servidor:** `root@46.202.89.177`  
**Pasta:** `/var/vertix`  
**Porta:** `3005`  
**Remoto git de produção:** `https://github.com/fabiano-araujo/vertix-server.git`  
**Node em produção:** `20.19.5` (usar `YARN_IGNORE_ENGINES=1` porque o `package.json` pede `>=22`)  
**Chave SSH:** `C:\Users\Fabiano\Documents\server_oracle\private.ppk`

Nunca apagar nem alterar dados do banco. Não publicar Flutter, web, Play Store nem snapdark.com.

---

## 1. Enviar alterações locais para o git

No diretório `server/`:

1. Incluir no commit o código da API (src, prisma, package.json, yarn.lock, rotas). **Não** commitar `.env`, `dist/`, logs nem secrets.
2. `git push origin main`.

Sem isso, `git pull` no host não recebe o que está só na máquina local.

---

## 2. Atualizar o host e build (API continua no ar)

O processo antigo segue atendendo enquanto instala e compila. Só depois vem o reload.

```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git fetch origin && git pull --ff-only origin main || git reset --hard origin/main && YARN_IGNORE_ENGINES=1 yarn install && npx prisma generate && YARN_IGNORE_ENGINES=1 yarn build && pm2 reload vertix"
```

- Preferir `git pull --ff-only`.
- Se o pull falhar (modificações locais, untracked no caminho, histórico divergente): `git reset --hard origin/main`.
- **Não** usar `git clean`. O reset não apaga untracked (`.env` permanece).
- Usar `pm2 reload vertix` (modo cluster, mínimo downtime). `pm2 restart vertix` só se o reload falhar.

## Deploy rápido (já está no git, só build)

```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git fetch origin && git pull --ff-only origin main || git reset --hard origin/main && YARN_IGNORE_ENGINES=1 yarn build && pm2 reload vertix"
```

## Reiniciar

```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 reload vertix"
```

## Logs

```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 logs vertix --lines 50"
```

## Status

```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 status"
```
