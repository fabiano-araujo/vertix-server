# Deploy do Vertix API

Este é o único deploy acionado por `deploy` / `deploy do servidor` neste workspace: o submódulo Node.js em `server/`. Não é a Music API, nem o app Flutter.

**Servidor:** `root@46.202.89.177`
**Pasta:** `/var/vertix`
**Porta:** `3005`
**Remoto git de produção:** `https://github.com/fabiano-araujo/vertix-server.git`
**Node em produção:** `20.19.5` (usar `YARN_IGNORE_ENGINES=1` porque o `package.json` pede `>=22`)

Não executar `git reset --hard` em `/var/vertix`.

---

## Deploy completo
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git pull && YARN_IGNORE_ENGINES=1 yarn install && npx prisma generate && YARN_IGNORE_ENGINES=1 yarn build && pm2 restart vertix"
```

## Deploy rápido
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git pull && YARN_IGNORE_ENGINES=1 yarn build && pm2 restart vertix"
```

## Reiniciar
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 restart vertix"
```

## Logs
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 logs vertix --lines 50"
```

## Status
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "pm2 status"
```
