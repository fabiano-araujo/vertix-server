# Deploy do Vertix API

Este é o único deploy acionado por `deploy` / `deploy do servidor` neste workspace: o Node.js em `server/`. Não é a Music API, nem o app Flutter.

## Versão que deve ser enviada

A versão publicada é **toda** a pasta `server/` que está na máquina local — a mesma que roda em `http://localhost:3005` e que o app em `flutter run` chama em produção via `https://vertix-api.snapdark.com`.

| Campo | Valor |
| --- | --- |
| Remoto git | `https://github.com/fabiano-araujo/vertix-server.git` |
| `package.json` version | `1.0.0` |
| Node no host | `20.19.5` (`engines` pede `>=22` → usar `YARN_IGNORE_ENGINES=1`) |
| Servidor | `root@46.202.89.177` |
| Pasta | `/var/vertix` |
| Porta | `3005` |
| PM2 | `vertix` |
| Chave SSH | `C:\Users\Fabiano\Documents\server_oracle\private.ppk` |

O app Flutter que roda no Android/emulador é `pubspec.yaml` `1.0.0+1` no repo `vertix-app`. Este deploy **não** publica esse app; só a API.

**Incluir no envio (nada a menos):** `src/` (index, rotas, controllers, services, middlewares, config), `prisma/` (schema + migrations), `tests/`, `package.json`, `yarn.lock`, `.gitignore`, `deploy.md`.

**Não enviar:** `.env`, `dist/`, `node_modules`, `*.err.log`, `*.out.log`, `public/dola-runs/`, `public/openrouter-video-runs/`, secrets.

Nunca apagar nem alterar dados do banco. Não publicar Flutter, web, Play Store nem snapdark.com.

---

## 1. Enviar alterações locais para o git

No diretório `server/` (remoto `vertix-server`):

1. Commitar **todas** as alterações locais da API, mesmo que não sejam do chat atual. Não cherry-pick de arquivos.
2. `git push origin main`.

Sem isso, `git pull` no host não recebe o que está só na máquina local. O host **não** puxa commits do `vertix-app`.

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
