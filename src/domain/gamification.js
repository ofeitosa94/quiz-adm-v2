import { getPeriods } from './periods.js';

// Tabela Oficial de Conquistas Permanentes + Secretas
export const CONQUISTAS_SISTEMA = [
  // 📚 Participação
  { id: 'part_1', cat: 'Participação', nome: 'Primeiro Passo', desc: 'Responder 10 questões no total', icone: '🎯', xp: 30, secreta: false, checar: (u) => (u.questoesRespondidas || 0) >= 10 },
  { id: 'part_2', cat: 'Participação', nome: 'Participante', desc: 'Completar 3 quizzes no total', icone: '📚', xp: 50, secreta: false, checar: (u) => (u.quizzesRealizados || 0) >= 3 },
  { id: 'part_3', cat: 'Participação', nome: 'Ativo', desc: 'Completar 6 quizzes no total', icone: '⚡', secreta: false, xp: 75, checar: (u) => (u.quizzesRealizados || 0) >= 6 },
  { id: 'part_4', cat: 'Participação', nome: 'Dedicado', desc: 'Completar 10 quizzes no total', icone: '🔥', secreta: false, xp: 100, checar: (u) => (u.quizzesRealizados || 0) >= 10 },

  // 🎯 Desempenho Geral
  { id: 'des_1', cat: 'Desempenho', nome: 'Primeiro Acerto', desc: 'Acertar 1 questão no total', icone: '✅', xp: 20, secreta: false, checar: (u) => (u.questoesAcertadas || 0) >= 1 },
  { id: 'des_2', cat: 'Desempenho', nome: 'Conhecedor', desc: '25 acertos no total', icone: '🧠', xp: 50, secreta: false, checar: (u) => (u.questoesAcertadas || 0) >= 25 },
  { id: 'des_3', cat: 'Desempenho', nome: 'Bom Desempenho', desc: '50 acertos no total', icone: '🌟', xp: 75, secreta: false, checar: (u) => (u.questoesAcertadas || 0) >= 50 },
  { id: 'des_4', cat: 'Desempenho', nome: 'Especialista', desc: '100 acertos no total', icone: '🥇', xp: 150, secreta: false, checar: (u) => (u.questoesAcertadas || 0) >= 100 },
  { id: 'des_5', cat: 'Desempenho', nome: 'Mestre do Quiz', desc: '150 acertos no total', icone: '👑', xp: 250, secreta: false, checar: (u) => (u.questoesAcertadas || 0) >= 150 },

  // 🔥 Desempenho no Quiz (Sessão Única)
  { id: 'quiz_1', cat: 'Quiz', nome: 'Quiz Completo', desc: 'Finalizar um bloco de 10', icone: '🏁', xp: 20, secreta: false, checar: (_, acertosQuiz) => acertosQuiz >= 0 },
  { id: 'quiz_2', cat: 'Quiz', nome: 'Mão Cheia', desc: 'Acertar 5/10 em um quiz', icone: '✋', xp: 30, secreta: false, checar: (_, acertosQuiz) => acertosQuiz >= 5 },
  { id: 'quiz_3', cat: 'Quiz', nome: 'Bom Quiz', desc: 'Acertar 7/10 em um quiz', icone: '👍', xp: 50, secreta: false, checar: (_, acertosQuiz) => acertosQuiz >= 7 },
  { id: 'quiz_4', cat: 'Quiz', nome: 'Excelente', desc: 'Acertar 9/10 em um quiz', icone: '🚀', xp: 75, secreta: false, checar: (_, acertosQuiz) => acertosQuiz >= 9 },
  { id: 'quiz_5', cat: 'Quiz', nome: 'Perfeito', desc: 'Acertar 10/10 em um quiz', icone: '💯', xp: 100, secreta: false, checar: (_, acertosQuiz) => acertosQuiz === 10 },

  // 🏅 Categorias / Disciplinas
  { id: 'cat_1', cat: 'Categorias', nome: 'Explorador', desc: 'Responder ≥10 questões em 3 categorias', icone: '🗺️', xp: 50, secreta: false, checar: (u) => Object.keys(u.categoriasRespondidas || {}).filter(k => u.categoriasRespondidas[k] >= 10).length >= 3 },
  { id: 'cat_2', cat: 'Categorias', nome: 'Multidisciplinar', desc: 'Responder questões em 5 categorias', icone: '🧩', xp: 100, secreta: false, checar: (u) => Object.keys(u.categoriasRespondidas || {}).length >= 5 },
  { id: 'cat_3', cat: 'Categorias', nome: 'Generalista', desc: 'Responder questões nas 10 categorias', icone: '🎓', xp: 200, secreta: false, checar: (u) => Object.keys(u.categoriasRespondidas || {}).length >= 10 },

  // 🔒 Conquistas Secretas (Ocultas até desbloquear)
  { id: 'sec_1', cat: 'Secreta', nome: 'Velocista ADM', desc: 'Respondeu e acertou uma questão em menos de 5s', icone: '⚡', xp: 100, secreta: true, checar: (_, __, tempoRestante) => tempoRestante > 55 },
  { id: 'sec_2', cat: 'Secreta', nome: 'Perfeição Absoluta', desc: 'Concluiu um quiz com 100% sem cometer erros', icone: '💎', xp: 200, secreta: true, checar: (_, acertosQuiz) => acertosQuiz === 10 },
  { id: 'sec_3', cat: 'Secreta', nome: 'Coruja da Madrugada', desc: 'Estudou e concluiu um quiz no turno da noite/madrugada', icone: '🦉', xp: 80, secreta: true, checar: (_, acertosQuiz) => { const h = getPeriods().hour; return acertosQuiz >= 0 && (h >= 22 || h < 4); } }
];

// Array Completo de Missões (DEFAULT_MISSIONS) - 3 Diárias | 5 Semanais | 8 Mensais
export const DEFAULT_MISSIONS = [
  // 🟢 Diárias (3)
  { id: 'dia_1', tipo: 'Diária', nome: 'Primeiro Bloco', desc: 'Completar 1 quiz completo', alvo: 1, xp: 30, progresso: (u) => u.progressoMissoes?.quizzesHoje || 0 },
  { id: 'dia_2', tipo: 'Diária', nome: 'Foco Diário', desc: 'Obter 3 acertos em questões hoje', alvo: 3, xp: 35, progresso: (u) => u.progressoMissoes?.acertosHoje || 0 },
  { id: 'dia_3', tipo: 'Diária', nome: 'Meta do Dia', desc: 'Obter 5 acertos em questões hoje', alvo: 5, xp: 50, progresso: (u) => u.progressoMissoes?.acertosHoje || 0 },

  // 🔵 Semanais (5)
  { id: 'sem_1', tipo: 'Semanal', nome: 'Maratona Semanal', desc: 'Completar 5 quizzes nesta semana', alvo: 5, xp: 100, progresso: (u) => u.progressoMissoes?.quizzesSemana || 0 },
  { id: 'sem_2', tipo: 'Semanal', nome: 'Construindo Base', desc: 'Obter 15 acertos esta semana', alvo: 15, xp: 120, progresso: (u) => u.progressoMissoes?.acertosSemana || 0 },
  { id: 'sem_3', tipo: 'Semanal', nome: 'Domínio Semanal', desc: 'Obter 30 acertos esta semana', alvo: 30, xp: 180, progresso: (u) => u.progressoMissoes?.acertosSemana || 0 },
  { id: 'sem_4', tipo: 'Semanal', nome: 'Mestre da Semana', desc: 'Completar 10 quizzes nesta semana', alvo: 10, xp: 220, progresso: (u) => u.progressoMissoes?.quizzesSemana || 0 },
  { id: 'sem_5', tipo: 'Semanal', nome: 'Precisão Cirúrgica', desc: 'Completar 1 quiz com 100% de precisão (10/10)', alvo: 1, xp: 200, progresso: (u) => u.progressoMissoes?.quizzesPerfeitosSemana || 0 },

  // 🔴 Mensais (8)
  { id: 'men_1', tipo: 'Mensal', nome: 'Ritmo Mensal', desc: 'Completar 20 quizzes durante o mês', alvo: 20, xp: 300, progresso: (u) => u.quizzesRealizadosMes || 0 },
  { id: 'men_2', tipo: 'Mensal', nome: 'Meio Caminho', desc: 'Obter 50 acertos no mês', alvo: 50, xp: 250, progresso: (u) => u.questoesAcertadasMes || 0 },
  { id: 'men_3', tipo: 'Mensal', nome: 'Centena', desc: 'Obter 100 acertos no mês', alvo: 100, xp: 400, progresso: (u) => u.questoesAcertadasMes || 0 },
  { id: 'men_4', tipo: 'Mensal', nome: 'Acúmulo de XP', desc: 'Alcançar 2500 XP na temporada atual', alvo: 2500, xp: 500, progresso: (u) => u.xpTemporada || 0 },
  { id: 'men_5', tipo: 'Mensal', nome: 'Consistência de Aço', desc: 'Completar 50 quizzes no mês', alvo: 50, xp: 600, progresso: (u) => u.quizzesRealizadosMes || 0 },
  { id: 'men_6', tipo: 'Mensal', nome: 'Subindo de Nível', desc: 'Alcançar o Nível 5 de progresso', alvo: 5, xp: 350, progresso: (u) => Math.floor((u.pontuacaoGeral || 0) / 500) + 1 },
  { id: 'men_7', tipo: 'Mensal', nome: 'Perfeição Constante', desc: 'Completar 5 quizzes sem errar nada (100% de precisão)', alvo: 5, xp: 500, progresso: (u) => u.progressoMissoes?.quizzesPerfeitosMes || 0 },
  { id: 'men_8', tipo: 'Mensal', nome: 'Lenda do Mês', desc: 'Obter 300 acertos acumulados no mês', alvo: 300, xp: 800, progresso: (u) => u.questoesAcertadasMes || 0 }
];

