export const AREAS_ADMINISTRACAO = [
  'Administração e Gestão', 'Gestão de Pessoas', 'Gestão Financeira e Contábil',
  'Marketing e Vendas', 'Empreendedorismo', 'Materiais e Logística',
  'Produção e Qualidade', 'Estratégia e Processos', 'Direito, Legislação e Ética',
  'Tecnologia e Ferramentas Administrativas'
];

const aliases = {
  'Administração Geral': 'Administração e Gestão',
  'Finanças': 'Gestão Financeira e Contábil',
  'Administração Financeira': 'Gestão Financeira e Contábil',
  'Marketing': 'Marketing e Vendas'
};
export const normalizeText = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');
export const questionKey = q => normalizeText(q.pergunta).toLocaleLowerCase('pt-BR');

export function normalizeQuestion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Questão inválida.');
  for (const key of ['disciplina', 'pergunta', 'dificuldade', 'explicacao']) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) throw new Error(`Campo obrigatório: ${key}.`);
  }
  const disciplina = aliases[normalizeText(raw.disciplina)] || normalizeText(raw.disciplina);
  if (!AREAS_ADMINISTRACAO.includes(disciplina)) throw new Error(`Disciplina desconhecida: ${disciplina}.`);
  if (!['Fácil', 'Médio', 'Difícil'].includes(raw.dificuldade)) throw new Error('Dificuldade inválida.');
  if (!Array.isArray(raw.alternativas) || raw.alternativas.length !== 5 ||
      raw.alternativas.some(a => typeof a !== 'string' || !a.trim())) throw new Error('Informe cinco alternativas válidas.');
  const alternativas = raw.alternativas.map(a => normalizeText(a).replace(/^[A-Ea-e]\s*[).:\-]\s*/, '').trim());
  if (alternativas.some(a => !a) || new Set(alternativas.map(a => a.toLocaleLowerCase('pt-BR'))).size !== 5) {
    throw new Error('As alternativas precisam ser preenchidas e diferentes.');
  }
  if (!Number.isInteger(raw.respostaCorreta) || raw.respostaCorreta < 0 || raw.respostaCorreta > 4) {
    throw new Error('O gabarito deve ser um número inteiro entre 0 e 4.');
  }
  return { disciplina, dificuldade: raw.dificuldade, tipo: typeof raw.tipo === 'string' ? raw.tipo.trim() || 'Geral' : 'Geral',
    pergunta: normalizeText(raw.pergunta), alternativas, respostaCorreta: raw.respostaCorreta, explicacao: raw.explicacao.trim() };
}

export function validateImport(raw, existing = []) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('O arquivo precisa conter uma lista de questões.');
  const seen = new Set(existing.filter(q => typeof q?.pergunta === 'string').map(questionKey));
  let duplicates = 0;
  const questions = [];
  raw.forEach((item, index) => {
    let q;
    try { q = normalizeQuestion(item); } catch (error) { throw new Error(`Questão ${index + 1}: ${error.message}`); }
    const key = questionKey(q);
    if (seen.has(key)) duplicates++;
    else { seen.add(key); questions.push(q); }
  });
  return { questions, duplicates };
}

export function shuffleArray(array, random = Math.random) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function prepareQuestions(source, user, count = 10) {
  const answered = user?.questoesRespondidasHoje || [];
  const wrong = user?.questoesErradasHoje || [];
  const unique = [...new Map(source.map(q => [questionKey(q), q])).values()];
  const ordered = [
    ...shuffleArray(unique.filter(q => !answered.includes(q.id))),
    ...shuffleArray(unique.filter(q => answered.includes(q.id) && !wrong.includes(q.id))),
    ...shuffleArray(unique.filter(q => answered.includes(q.id) && wrong.includes(q.id)))
  ];
  return ordered.slice(0, count).map(q => {
    const alternatives = shuffleArray(q.alternativas.map((text, index) => ({ text, correct: index === q.respostaCorreta })));
    return { ...q, alternativas: alternatives.map(a => a.text), respostaCorreta: alternatives.findIndex(a => a.correct) };
  });
}
