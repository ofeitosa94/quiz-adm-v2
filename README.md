# Quiz ADM

Aplicação de estudos de Administração com React 18, Vite 5, Tailwind CSS 3 e Firebase Authentication/Firestore. O site de produção é https://quiz-adm-v2.vercel.app e a Vercel publica os commits da branch `main` deste repositório.

## Desenvolvimento

Use Node.js 22 ou superior. Execute os comandos nesta pasta, que contém o `package-lock.json` da aplicação:

```sh
npm ci
npm run dev
npm test
npm run build
```

A pasta superior `adm_quiz` não é a raiz da aplicação. Seu outro `package.json` é legado e não deve ser usado para instalar ou executar este site.

## Estrutura

- `src/App.jsx`: telas e coordenação da sessão.
- `src/domain/questions.js`: validação, categorias oficiais, deduplicação e embaralhamento.
- `src/domain/periods.js`: calendário no fuso America/Sao_Paulo e resets.
- `src/domain/gamification.js`: catálogo de conquistas permanentes e missões temporárias.
- `src/domain/progress.js`: pontuação e aplicação idempotente dos eventos de quiz.
- `src/services/quizService.js`: transações, importação e temporadas no Firestore.
- `src/data/questions.json`: banco principal versionado, com 200 questões (20 por área).
- `tests/quiz.test.js`: testes de regressão das regras de negócio e do banco.

## Regras de estudo

Um quiz completo tem dez questões. Sessões menores e revisões não geram bônus de conclusão, conquistas de quiz perfeito ou contadores de quizzes completos. O modo de revisão inicia sua própria contagem de acertos e XP e permite revisar novamente os erros persistentes.

Cada pergunta tem 60 segundos. O XP base é 15/30/50 para fácil/médio/difícil, com desconto de três pontos a cada dez segundos. Questões repetidas no mesmo dia recebem metade do XP e interrompem o bônus de sequência. Na revisão, a base é 10/15/25. Respostas corretas rápidas podem desbloquear a conquista Velocista; erros e respostas com cinco segundos ou mais não a desbloqueiam.

Conquistas são permanentes, baseadas no histórico geral. Missões diárias, semanais e mensais seguem o calendário de São Paulo, com semana ISO iniciada na segunda-feira. Um dia ativo exige cinco questões distintas respondidas. O encerramento manual da temporada zera apenas seu XP; mantém conquistas, histórico e missões do calendário. Não recupera conquistas que versões antigas já apagaram.

A gravação de resposta, progresso e recompensas ocorre na mesma transação. Os 64 eventos mais recentes ficam identificados para evitar duplicação causada por retentativas de rede. A interface bloqueia ações simultâneas e mostra falhas de gravação.

## Banco de questões

O importador aceita um array JSON. Cada item contém `disciplina`, `dificuldade`, `tipo`, `pergunta`, `alternativas` (cinco textos), `respostaCorreta` (inteiro de 0 a 4) e `explicacao`.

O arquivo inteiro é validado antes da primeira gravação. Categorias legadas conhecidas são normalizadas; letras iniciais nas alternativas são removidas. Enunciados iguais após normalização de caixa e espaços são considerados duplicados. A importação usa IDs determinísticos e lotes de até 400 itens. Se houver falha em um lote posterior, o aviso informa quantos itens foram importados e o arquivo pode ser reenviado.

O administrador pode importar o banco principal pela tela inicial quando o banco remoto estiver vazio. Os JSONs e TXT fora deste repositório são materiais de elaboração; somente o banco em `src/data` integra a publicação.

## Firebase e publicação

O projeto existente é `quiz-administracao`, banco `(default)`, edição Standard, região `southamerica-east1`. A configuração web de conexão está em `src/firebase.js`. Ela identifica o projeto e não substitui as regras de autorização.

O encerramento de temporada grava `settings/season` e redefine o XP dos perfis no mesmo lote. Há limite explícito de 200 perfis por operação para evitar uma atualização parcial; instalações maiores precisam de processamento no servidor. A configuração global define a temporada para novos cadastros. O ranking usa uma coleção separada, sem e-mail, curso, turma ou unidade; os perfis completos só podem ser lidos pelo próprio aluno e pelo administrador. As regras publicadas precisam permitir as consultas e transações documentadas no código.

A autorização administrativa não deve depender somente dos botões do navegador. O administrador é identificado pelo UID da conta existente, e alterações de identidade/privilégios são bloqueadas para os alunos. A validação de pontuação nesta versão ainda é executada pelo cliente; transações e bloqueios de interface evitam erros acidentais, mas não substituem pontuação autoritativa no servidor contra adulteração deliberada.

Antes de publicar: `npm test` e `npm run build`. Envie as alterações para `main` e confirme o deployment Production da Vercel correspondente ao commit. A publicação do site e a das regras do Firebase são operações separadas.

O projeto está sem faturamento habilitado. Cloud Functions para pontuação autoritativa exigirá uma decisão separada sobre infraestrutura/plano. As regras foram fortalecidas e devem ser reavaliadas ao adicionar novos campos ou fluxos.

## Preparação do teste de 14 de setembro de 2026

O reset solicitado para o teste inclui XP geral e da temporada, estatísticas, categorias, missões, conquistas e eventos processados. Preserva contas do Authentication, informações de cadastro e perguntas. O ranking deve ser reconstruído a partir dos perfis já zerados; apagar apenas `rankings` não zera a origem dos pontos em `users`.

`initialProgress` define um estado inicial único para novos cadastros e resets. O cadastro pode ser concluído novamente quando a conta foi criada, mas a gravação do perfil falhou por conexão. A criação transacional não sobrescreve um perfil já existente.

As 21 simulações em `tests/security-cases.json` foram executadas na [API de testes de regras do Firebase](https://firebase.google.com/docs/reference/rules/rest/v1/projects/test), sem gravar os documentos simulados. Elas incluem leitura privada, cadastro, autopromoção, alteração de identidade, validação de perguntas e projeção pública do ranking.
