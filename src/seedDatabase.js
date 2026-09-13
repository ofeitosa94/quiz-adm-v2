import { importQuestions } from './services/quizService';
export async function popularBancoPerguntas() {
  const { default: questions } = await import('./data/questions.json');
  return importQuestions(questions);
}
