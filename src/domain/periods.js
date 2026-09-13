export function getPeriods(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const month = day.slice(0, 7);
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = `${year}-W${Math.ceil((((date - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7)}`;
  const name = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long' }).format(now).toLocaleUpperCase('pt-BR');
  return { day, month, week, hour: Number(parts.hour), seasonName: `${name}/${parts.year}` };
}

export function resetPeriods(input, missions, now = new Date()) {
  const p = getPeriods(now);
  const data = { pontuacaoGeral: 0, xpTemporada: 0, ...input, progressoMissoes: { quizzesHoje: 0, acertosHoje: 0, quizzesSemana: 0,
    acertosSemana: 0, quizzesPerfeitosSemana: 0, quizzesPerfeitosMes: 0, ...input.progressoMissoes },
    missoesConcluidas: [...(input.missoesConcluidas || [])] };
  const clear = type => {
    const ids = missions.filter(m => m.tipo === type).map(m => m.id);
    data.missoesConcluidas = data.missoesConcluidas.filter(id => !ids.includes(id));
  };
  if (data.ultimoDiaAtivo !== p.day) {
    Object.assign(data, { ultimoDiaAtivo: p.day, questoesRespondidasHoje: [], questoesErradasHoje: [], respostasNoDia: 0 });
    Object.assign(data.progressoMissoes, { quizzesHoje: 0, acertosHoje: 0 });
    clear('Diária');
  }
  if (data.ultimaSemanaAtiva !== p.week) {
    data.ultimaSemanaAtiva = p.week;
    Object.assign(data.progressoMissoes, { quizzesSemana: 0, acertosSemana: 0, quizzesPerfeitosSemana: 0 });
    clear('Semanal');
  }
  if (data.ultimoMesAtivo !== p.month) {
    Object.assign(data, { ultimoMesAtivo: p.month, questoesRespondidasMes: 0, questoesAcertadasMes: 0,
      quizzesRealizadosMes: 0, diasAtivosMes: [] });
    data.progressoMissoes.quizzesPerfeitosMes = 0;
    clear('Mensal');
  }
  return data;
}

export function newSeasonData(data, seasonName) {
  // Only seasonal XP changes. Permanent achievements and calendar missions survive.
  return { ...data, xpTemporada: 0, temporadaAtual: seasonName };
}

export function initialProgress(seasonName = getPeriods().seasonName, now = new Date()) {
  const p = getPeriods(now);
  return {
    pontuacaoGeral: 0, xpTemporada: 0, quizzesRealizados: 0, questoesRespondidas: 0,
    questoesAcertadas: 0, maiorSequencia: 0, quizzesRealizadosMes: 0,
    questoesRespondidasMes: 0, questoesAcertadasMes: 0, categoriasRespondidas: {},
    conquistasDesbloqueadas: [], missoesConcluidas: [], diasAtivosMes: [],
    ultimoDiaAtivo: p.day, ultimaSemanaAtiva: p.week, ultimoMesAtivo: p.month,
    questoesRespondidasHoje: [], questoesErradasHoje: [], respostasNoDia: 0,
    temporadaAtual: seasonName, recentQuizEvents: [],
    progressoMissoes: { quizzesHoje: 0, acertosHoje: 0, quizzesSemana: 0,
      acertosSemana: 0, quizzesPerfeitosSemana: 0, quizzesPerfeitosMes: 0 }
  };
}
