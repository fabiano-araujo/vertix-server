# Vertix Codex workflow

The Flutter production editor sends authenticated jobs to `POST /admin/codex/jobs`.
The route uses the existing Vertix JWT and requires the `ADMIN` role. API keys are
never sent to Flutter.

## Providers

- Text workflow: servidor de IA configurado em `codex-workflow.service.ts`
- Reference images: uma tarefa local do Codex usa `$imagegen`, com uma imagem
  por ficha, e envia cada arquivo imediatamente para a Vertix API

The Codex child process receives a restricted environment, an isolated working
directory, read-only sandboxing, disabled network tools, and no approval prompts.
Story/project JSON is explicitly treated as untrusted data.

## Actions

- `GENERATE_SERIES_OUTLINE`: season overview, episode outlines, characters,
  environments, props, and reference descriptions. It does not create scripts.
- `GENERATE_STORY_SHEETS`: character, location and prop sheets from an existing
  outline. It does not invent a new title, contract or episodes.
- `GENERATE_EPISODE_SCRIPT`: detailed scenes, shots, dialogue/action rows, and
  exact duration validation for one episode.
- `GENERATE_PRODUCTION_SCENES`: dynamic production prompt cores created only
  after script review. Flutter appends the fixed style and negative locks.
- `REVISE_PROJECT`: applies a natural-language adjustment while preserving
  locked scripts.

Jobs are polled through the existing `GET /admin/jobs/:id` route. That route is
scoped to the authenticated job owner.

## Reference image jobs

`POST /admin/series/:id/reference-image-jobs` cria um job autenticado e devolve
uma credencial aleatoria com validade de 24 horas. Essa credencial nao e o JWT
do administrador: ela autoriza somente o manifesto, o progresso e os uploads do
job criado.

No Windows, `tools/vertix-codex-bridge/install.ps1` registra o protocolo
`vertixcodex://`. O editor abre esse protocolo, a ponte inicia `codex exec`,
injeta a credencial em variaveis de ambiente e abre a tarefa criada no app
Codex. A skill instalada em `$CODEX_HOME/skills/vertix-reference-images`
processa as fichas sequencialmente.

Endpoints consumidos pela skill:

- `GET /codex/reference-image-jobs/:id`
- `POST /codex/reference-image-jobs/:id/items/:referenceId/status`
- `POST /codex/reference-image-jobs/:id/items/:referenceId/upload`
- `POST /codex/reference-image-jobs/:id/complete`

## Configuration

Copy the relevant variables from `.env.example` into the server `.env`:

```dotenv
CODEX_MODEL=
CODEX_WORKING_DIRECTORY=
```

Reference images use the authenticated Codex session on the workstation and o
gerador embutido, sem `OPENAI_API_KEY`. The production API only stores job
state and receives the finished bitmap; it does not inherit the workstation's
Codex login.
