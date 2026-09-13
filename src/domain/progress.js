import { getPeriods, resetPeriods } from './periods.js';
import { CONQUISTAS_SISTEMA, DEFAULT_MISSIONS } from './gamification.js';

export function applyQuizEvent(input, event, now = new Date()) {
  let data = resetPeriods(input, DEFAULT_MISSIONS, now);
  const previous = (data.recentQuizEvents || []).find(e => e.id === event.id);
  if (previous) return { ...previous, data };
  const periods = getPeriods(now);
  let xp = 0, bonus = '', correct = false, streak = event.streak || 0;
  let achievementScore = -1, speed = 0;
  const add = (key, amount = 1) => { data[key] = (data[key] || 0) + amount; };
  if (event.type === 'answer') {
    const q = event.question;
    correct = event.remaining > 0 && event.selected === q.respostaCorreta;
    const answered = data.questoesRespondidasHoje || [];
    const repeated = answered.includes(q.id);
    data.questoesRespondidasHoje = [...new Set([...answered, q.id])];
    data.questoesErradasHoje = correct
      ? (data.questoesErradasHoje || []).filter(id => id !== q.id)
      : [...new Set([...(data.questoesErradasHoje || []), q.id])];
    add('questoesRespondidas'); add('questoesRespondidasMes'); add('respostasNoDia');
    data.categoriasRespondidas = { ...data.categoriasRespondidas,
      [q.disciplina]: (data.categoriasRespondidas?.[q.disciplina] || 0) + 1 };
    // An active day requires five distinct questions, not merely opening the app.
    if (data.questoesRespondidasHoje.length >= 5) {
      data.diasAtivosMes = [...new Set([...(data.diasAtivosMes || []), periods.day])];
    }
    if (correct) {
      add('questoesAcertadas'); add('questoesAcertadasMes');
      data.progressoMissoes.acertosHoje++;
      data.progressoMissoes.acertosSemana++;
      speed = event.remaining;
      const base = event.review ? { 'Fácil': 10, 'Médio': 15, 'Difícil': 25 } : { 'Fácil': 15, 'Médio': 30, 'Difícil': 50 };
      xp = Math.max(0, base[q.dificuldade] - Math.floor((60 - event.remaining) / 10) * 3);
      if (!event.review) {
        if (repeated) { xp = Math.floor(xp / 2); streak = 0; bonus = 'Questão repetida hoje: metade do XP, sem bônus de sequência.'; }
        else {
          streak++;
          data.maiorSequencia = Math.max(data.maiorSequencia || 0, streak);
          if (streak === 3) { xp += 20; bonus = 'Sequência de 3 acertos! +20 XP'; }
          if (streak === 5) { xp += 50; bonus = 'Sequência de 5 acertos! +50 XP'; }
        }
      }
    } else streak = 0;
  } else if (event.type === 'finish') {
    if (!event.review && event.total === 10) {
      add('quizzesRealizados'); add('quizzesRealizadosMes');
      data.progressoMissoes.quizzesHoje++;
      data.progressoMissoes.quizzesSemana++;
      xp = 30;
      achievementScore = event.correctCount;
      if (event.correctCount === 10) {
        data.progressoMissoes.quizzesPerfeitosSemana++;
        data.progressoMissoes.quizzesPerfeitosMes++;
      }
    }
  } else throw new Error('Evento de quiz inválido.');
  add('pontuacaoGeral', xp); add('xpTemporada', xp);
  const achievements = [], missions = [];
  let awardXp = 0;
  data.conquistasDesbloqueadas = [...(data.conquistasDesbloqueadas || [])];
  for (const achievement of CONQUISTAS_SISTEMA) {
    const eligible = achievement.id === 'sec_3'
      ? achievementScore >= 0 && (periods.hour >= 22 || periods.hour < 4)
      : achievement.checar(data, achievementScore, speed);
    if (!data.conquistasDesbloqueadas.includes(achievement.id) && eligible) {
      achievements.push(achievement.id);
      data.conquistasDesbloqueadas.push(achievement.id);
      awardXp += achievement.xp;
    }
  }
  add('pontuacaoGeral', awardXp); add('xpTemporada', awardXp);
  // Resolve missions again when a reward crosses a level/XP threshold.
  let unlocked;
  do {
    unlocked = false;
    for (const mission of DEFAULT_MISSIONS) {
      if (!data.missoesConcluidas.includes(mission.id) && mission.progresso(data) >= mission.alvo) {
        data.missoesConcluidas.push(mission.id); missions.push(mission.id);
        add('pontuacaoGeral', mission.xp); add('xpTemporada', mission.xp);
        awardXp += mission.xp; unlocked = true;
      }
    }
  } while (unlocked);
  const result = { id: event.id, xp, awardXp, bonus, correct, streak, achievements, missions };
  data.recentQuizEvents = [...(data.recentQuizEvents || []).slice(-63), result];
  return { ...result, data };
}
