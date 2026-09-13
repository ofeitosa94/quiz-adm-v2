import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPeriods, resetPeriods, newSeasonData, initialProgress } from '../src/domain/periods.js';
import { normalizeQuestion, prepareQuestions, validateImport, AREAS_ADMINISTRACAO } from '../src/domain/questions.js';
import { applyQuizEvent } from '../src/domain/progress.js';
import { CONQUISTAS_SISTEMA, DEFAULT_MISSIONS } from '../src/domain/gamification.js';

const noon = new Date('2026-09-13T15:00:00Z');
const night = new Date('2026-09-14T02:00:00Z');
const question = { id: 'q1', disciplina: 'Gestão de Pessoas', dificuldade: 'Médio', tipo: 'Teste',
  pergunta: 'Qual é a alternativa correta?', alternativas: ['A) Uma', 'B) Duas', 'C) Três', 'D) Quatro', 'E) Cinco'], respostaCorreta: 1, explicacao: 'Duas é a correta.' };
const profile = () => resetPeriods({ pontuacaoGeral: 0, xpTemporada: 0, conquistasDesbloqueadas: [], categoriasRespondidas: {} }, DEFAULT_MISSIONS, noon);
const answer = (overrides = {}) => ({ id: 'session:answer:0', type: 'answer', question, selected: 1, remaining: 58, review: false, streak: 0, ...overrides });
const finish = (overrides = {}) => ({ id: 'session:finish', type: 'finish', total: 10, correctCount: 10, review: false, ...overrides });

test('all period boundaries use Sao Paulo including midnight and ISO week/year', () => {
  assert.equal(getPeriods(new Date('2026-10-01T02:59:59Z')).day, '2026-09-30');
  assert.equal(getPeriods(new Date('2026-10-01T03:00:00Z')).month, '2026-10');
  assert.equal(getPeriods(new Date('2027-01-01T15:00:00Z')).week, '2026-W53');
  assert.notEqual(getPeriods(new Date('2026-09-14T02:59:59Z')).week, getPeriods(new Date('2026-09-14T03:00:00Z')).week);
});
test('period reset returns fresh counters and preserves permanent achievements', () => {
  const old = { ...profile(), ultimoDiaAtivo: '2026-08-31', ultimaSemanaAtiva: '2026-W36', ultimoMesAtivo: '2026-08',
    questoesRespondidasMes: 100, conquistasDesbloqueadas: ['des_1'], missoesConcluidas: ['dia_1','sem_1','men_1'],
    progressoMissoes: { quizzesHoje: 3, quizzesSemana: 6, quizzesPerfeitosMes: 4 } };
  const result = resetPeriods(old, DEFAULT_MISSIONS, noon);
  assert.equal(result.questoesRespondidasMes, 0);
  assert.equal(result.progressoMissoes.quizzesHoje, 0);
  assert.equal(result.progressoMissoes.quizzesSemana, 0);
  assert.deepEqual(result.missoesConcluidas, []);
  assert.deepEqual(result.conquistasDesbloqueadas, ['des_1']);
  assert.equal(old.progressoMissoes.quizzesHoje, 3);
});
test('fast wrong answer and exact five seconds do not unlock speed achievement', () => {
  assert.ok(!applyQuizEvent(profile(), answer({ selected: 0 }), noon).achievements.includes('sec_1'));
  assert.ok(!applyQuizEvent(profile(), answer({ remaining: 55 }), noon).achievements.includes('sec_1'));
  assert.ok(applyQuizEvent(profile(), answer(), noon).achievements.includes('sec_1'));
});
test('night achievement requires finishing a full normal quiz', () => {
  assert.ok(!applyQuizEvent(profile(), answer(), night).achievements.includes('sec_3'));
  assert.ok(applyQuizEvent(profile(), finish(), night).achievements.includes('sec_3'));
  assert.ok(!applyQuizEvent(profile(), finish({ review: true }), night).achievements.includes('sec_3'));
});
test('review and short sessions do not count as complete/perfect quizzes', () => {
  for (const event of [finish({ review: true }), finish({ total: 3, correctCount: 3 })]) {
    const result = applyQuizEvent(profile(), event, noon);
    assert.equal(result.data.quizzesRealizados || 0, 0);
    assert.equal(result.data.progressoMissoes.quizzesPerfeitosSemana, 0);
    assert.equal(result.xp, 0);
    assert.ok(!result.achievements.includes('quiz_5'));
    assert.ok(!result.missions.includes('dia_1'));
  }
});
test('retrying answer or finish never duplicates XP, counts or awards', () => {
  for (const event of [answer(), finish()]) {
    const first = applyQuizEvent(profile(), event, noon);
    const replay = applyQuizEvent(first.data, event, noon);
    assert.deepEqual(replay, first);
  }
});
test('answer crossing midnight increments fresh daily counters', () => {
  const old = { ...profile(), ultimoDiaAtivo: '2026-09-12', progressoMissoes: { ...profile().progressoMissoes, acertosHoje: 99 } };
  const result = applyQuizEvent(old, answer(), noon);
  assert.equal(result.data.progressoMissoes.acertosHoje, 1);
  assert.ok(!result.missions.includes('dia_2'));
});
test('active day requires five distinct questions', () => {
  let data = profile();
  assert.deepEqual(data.diasAtivosMes, []);
  for (let i = 0; i < 4; i++) data = applyQuizEvent(data, answer({ id: `a${i}`, question: { ...question, id: `q${i}` } }), noon).data;
  assert.deepEqual(data.diasAtivosMes, []);
  data = applyQuizEvent(data, answer({ id: 'repeat', question: { ...question, id: 'q0' } }), noon).data;
  assert.deepEqual(data.diasAtivosMes, []);
  data = applyQuizEvent(data, answer({ id: 'fifth', question: { ...question, id: 'q4' } }), noon).data;
  assert.deepEqual(data.diasAtivosMes, ['2026-09-13']);
});
test('season transition preserves lifetime records and completed calendar missions', () => {
  const input = { ...profile(), temporadaAtual: 'Anterior', xpTemporada: 100, pontuacaoGeral: 1000,
    conquistasDesbloqueadas: ['des_1'], missoesConcluidas: ['dia_1','sem_1','men_1'] };
  const result = newSeasonData(input, 'Nova');
  assert.equal(result.xpTemporada, 0);
  assert.equal(result.pontuacaoGeral, 1000);
  assert.deepEqual(result.missoesConcluidas, input.missoesConcluidas);
  assert.deepEqual(result.conquistasDesbloqueadas, input.conquistasDesbloqueadas);
});
test('normalizes legacy categories and removes option letters', () => {
  const result = normalizeQuestion({ ...question, disciplina: 'Finanças' });
  assert.equal(result.disciplina, 'Gestão Financeira e Contábil');
  assert.deepEqual(result.alternativas, ['Uma','Duas','Três','Quatro','Cinco']);
});
test('rejects invalid answer index, duplicate alternatives and malformed imports before writing', () => {
  for (const q of [{ ...question, respostaCorreta: '1' }, { ...question, respostaCorreta: 5 },
    { ...question, alternativas: ['x','x','x','x','x'] }, { ...question, explicacao: '' }]) assert.throws(() => normalizeQuestion(q));
  assert.throws(() => validateImport([question, { ...question, respostaCorreta: 9 }]), /Questão 2/);
  assert.throws(() => validateImport({}));
});
test('deduplicates within import and against existing data using normalized text', () => {
  const result = validateImport([question, { ...question, pergunta: '  QUAL É A ALTERNATIVA CORRETA?  ' }], [question]);
  assert.equal(result.questions.length, 0);
  assert.equal(result.duplicates, 2);
});
test('shuffle preserves the correct alternative, also when reviewing already shuffled questions', () => {
  const normalized = { ...normalizeQuestion(question), id: question.id };
  for (let i = 0; i < 50; i++) {
    const first = prepareQuestions([normalized], {}, 10)[0];
    const review = prepareQuestions([first], { questoesRespondidasHoje: ['q1'], questoesErradasHoje: ['q1'] }, 1)[0];
    assert.equal(first.alternativas[first.respostaCorreta], 'Duas');
    assert.equal(review.alternativas[review.respostaCorreta], 'Duas');
  }
});
test('bundled bank contains 200 valid unique questions balanced across all ten areas', () => {
  const bank = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'));
  const { questions, duplicates } = validateImport(bank);
  assert.equal(questions.length, 200); assert.equal(duplicates, 0);
  for (const area of AREAS_ADMINISTRACAO) {
    const subset = questions.filter(q => q.disciplina === area);
    assert.equal(subset.length, 20);
    for (const [difficulty, count] of [['Fácil',10],['Médio',6],['Difícil',4]]) assert.equal(subset.filter(q => q.dificuldade === difficulty).length, count);
  }
});
test('earned XP includes base score and all rewards, without granting permanent awards twice', () => {
  const first = applyQuizEvent(profile(), answer(), noon);
  assert.equal(first.data.pontuacaoGeral, first.xp + first.awardXp);
  const second = applyQuizEvent(first.data, answer({ id: 'next' }), noon);
  assert.ok(!second.achievements.includes('sec_1'));
  assert.ok(!second.achievements.includes('des_1'));
});
test('timeout is incorrect even with the correct option selected', () => {
  const result = applyQuizEvent(profile(), answer({ remaining: 0 }), noon);
  assert.equal(result.correct, false); assert.equal(result.xp, 0);
});

test('test reset clears every progress field and preserves identity when merged', () => {
  const old = { uid: 'student', nome: 'Aluno', email: 'student@example.invalid', isAdmin: false,
    ...profile(), pontuacaoGeral: 9999, xpTemporada: 8000, questoesRespondidas: 200,
    conquistasDesbloqueadas: ['des_1'], recentQuizEvents: [{id:'old'}] };
  const data = { ...old, ...initialProgress('TESTE 14/09/2026', noon) };
  assert.equal(data.uid, old.uid); assert.equal(data.nome, old.nome); assert.equal(data.email, old.email);
  assert.equal(data.pontuacaoGeral, 0); assert.equal(data.xpTemporada, 0);
  assert.equal(data.questoesRespondidas, 0); assert.deepEqual(data.conquistasDesbloqueadas, []);
  assert.deepEqual(data.recentQuizEvents, []); assert.deepEqual(data.categoriasRespondidas, {});
  assert.ok(Object.values(data.progressoMissoes).every(v => v === 0));
  assert.equal(data.temporadaAtual, 'TESTE 14/09/2026');
});
