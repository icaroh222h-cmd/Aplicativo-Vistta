# Firebase no VISTTA

## Estado atual

Projeto Firebase: `vistta-2e1df`.

O VISTTA usa atualmente:

- **Authentication**: e-mail/senha, Google Login por redirect, logout e recuperação de senha.
- **Realtime Database**: perfis, empresas, cadastros, estoque, caixa, vendas e isolamento multiempresa.
- **Hosting**: frontend Vite publicado em `https://vistta-2e1df.web.app`.
- **Analytics**: integração opcional e carregada sob demanda quando `VITE_FIREBASE_MEASUREMENT_ID` está configurado e o navegador suporta Analytics.

## Compatibilidade com Spark

| Recurso | Estado | Observação |
| --- | --- | --- |
| Authentication | Usado | Os provedores usados são compatíveis com a cota gratuita aplicável. |
| Realtime Database | Usado | Sujeito às cotas de armazenamento e transferência do plano. |
| Hosting | Usado | Sujeito à cota gratuita de armazenamento e transferência. |
| Analytics | Integrado opcionalmente | Não envia senhas, tokens, nomes, e-mails ou valores financeiros. |
| App Check | Não ativado | Requer registro de reCAPTCHA e rollout controlado para não bloquear desenvolvimento. |
| Storage | Não usado | O sistema ainda não possui fluxo de anexos/imagens que justifique ativá-lo. |
| Cloud Messaging | Não usado | Não há requisito de notificações push implementado nem service worker FCM. |
| Remote Config | Não usado | Não há parâmetros remotos não sensíveis necessários atualmente. |
| Performance Monitoring | Não usado | Deve ser avaliado depois de definir metas de performance; não é necessário para o ERP funcionar. |
| Crashlytics | Não usado | Não há integração web equivalente adotada neste projeto; erros críticos são registrados localmente de forma estruturada. |
| Firestore | Não usado | O Realtime Database permanece adequado aos fluxos atuais. |
| Extensions | Não instaladas | Nenhuma extensão é necessária para o funcionamento atual. |
| Firebase AI Logic | Não usado | Não há caso de uso aprovado nem orçamento para IA. |

## Recursos que exigem Blaze

- **Cloud Functions**: o projeto contém código legado/preparado em `functions/`, mas o deploy foi removido da configuração padrão porque o Spark não permite o deploy dessas funções.
- Extensions que dependam de Cloud Functions, Billing ou serviços pagos.
- Recursos que ultrapassem as cotas gratuitas do produto.

O sistema operacional no Spark usa transações e gravações diretas no Realtime Database para caixa, vendas e estoque. Isso preserva o funcionamento gratuito, mas exige manter as Rules rigorosas e reconhecer que operações altamente sensíveis/conectadas podem exigir uma migração futura para backend/Admin SDK.

## Eventos Analytics implementados

Quando Analytics está disponível, o frontend registra apenas eventos de produto:

- `login` com método (`password` ou `google`);
- `logout`;
- `login_google`;
- `empresa_criada`.

Não são enviados e-mails, nomes, UID, tokens, senhas, valores de venda ou dados de clientes.

## Segurança

- Claims de developer são definidas exclusivamente por Admin SDK.
- Frontend não decide autorização de banco.
- Realtime Database Rules isolam cada `empresaId`.
- Leitura global exige `role == developer` e `platformOwner == true` no token.
- App Check não deve ser ativado sem configurar reCAPTCHA e testar localhost/produção separadamente.
- Variáveis `VITE_*` são configuração pública do app Web; credenciais Admin SDK nunca devem ser colocadas no frontend.

## Configuração manual

1. Em Authentication, manter Google ativado e os domínios autorizados cadastrados.
2. Em produção, cadastrar `VITE_FIREBASE_MEASUREMENT_ID` se Analytics for desejado.
3. Aplicar claims de developer usando Admin SDK e renovar o token com logout/login.
4. Não ativar Blaze automaticamente. Fazer upgrade somente se Functions/Storage/recursos além das cotas forem necessários.

## Decisões não implementadas

Storage, FCM, Remote Config, Performance Monitoring, Firestore e Extensions não foram adicionados apenas para aumentar a lista de serviços. Cada um exige uma necessidade funcional, configuração externa ou estratégia de quota que ainda não existe no VISTTA.
