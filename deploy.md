# Deploy do Vertix API

**Servidor:** `root@46.202.89.177`
**Pasta:** `/var/vertix`
**Porta:** `3005`

---

## Deploy completo
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git pull && yarn install && npx prisma generate && yarn build && pm2 restart vertix"
```

## Deploy rápido
```bash
plink -i "C:\Users\Fabiano\Documents\server_oracle\private.ppk" root@46.202.89.177 "cd /var/vertix && git pull && yarn build && pm2 restart vertix"
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
