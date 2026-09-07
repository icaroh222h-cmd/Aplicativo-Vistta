# Schema real do Firebase

Fonte: leitura do Realtime Database do projeto `vistta-2e1df` em 2026-09-07, além das Rules e dos acessos do código.

## Nós existentes

### `/users/{uid}`

Perfis observados:

```json
{
  "createdAt": "ISO-8601",
  "email": "string",
  "empresaId": "string",
  "nome": "string",
  "role": "admin | developer",
  "status": "active | boolean legado"
}
```

O perfil developer existente tem `status: true`, um valor legado que não deve ser usado como autorização. A autorização global depende das Custom Claims do ID token:

```json
{
  "role": "developer",
  "platformOwner": true
}
```

### `/empresas/{empresaId}/info`

Estrutura observada:

```json
{
  "criadoEm": "ISO-8601",
  "criadoPor": "uid",
  "nome": "string"
}
```

As empresas atuais não possuem, na raiz observada, nós de produtos, clientes, vendas, caixas, estoque, planos, assinaturas ou auditoria. Esses módulos só devem aparecer com dados depois que seus registros forem realmente criados.

## Relações

- `users/{uid}.empresaId` aponta para `empresas/{empresaId}`.
- `empresas/{empresaId}/info.criadoPor` contém o UID que criou a empresa.
- Admin, manager e user são escopados pelo `empresaId` do perfil.
- Developer é global por Custom Claims e não precisa de `empresaId`.

## Regras de bootstrap

Um usuário autenticado pode criar seu primeiro `users/{uid}` como `admin` sem `empresaId`. Depois, se for admin e ainda não possuir `empresaId`, pode criar `empresas/{empresaId}/info` com `criadoPor == auth.uid`. O vínculo posterior do perfil com a empresa é validado pelas Rules.

## Nós ainda não encontrados

Não foram encontrados no snapshot real:

- `/produtos`
- `/clientes`
- `/fornecedores`
- `/vendas`
- `/caixas`
- `/orcamentos`
- `/ordensServico`
- `/contas`
- `/categorias`
- `/usuarios`
- `/planos`
- `/assinaturas`
- `/auditoria`
- `/platformAudit`

As Rules e o frontend possuem suporte preparado para alguns desses caminhos dentro de uma empresa, mas a ausência no banco significa estado vazio, não motivo para criar dados fictícios.

## Segurança

- A raiz tem `.read: false` e `.write: false`.
- Leituras globais exigem `role == developer` e `platformOwner == true` no token.
- Usuários comuns não recebem acesso a outra empresa por alterar URL, payload ou estado React.
- Claims não são alteradas pelo frontend.
