import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

const perguntasIniciais = [
  {
    disciplina: 'Administração Geral',
    dificuldade: 'Fácil',
    tipo: 'Teoria Clássica',
    pergunta: 'Qual autor é reconhecido como o pai da Administração Científica?',
    alternativas: [
      'A) Henri Fayol',
      'B) Frederick Taylor',
      'C) Max Weber',
      'D) Elton Mayo',
      'E) Peter Drucker'
    ],
    respostaCorreta: 1, // Índice B (0-based)
    explicacao: 'Frederick Taylor fundou a Administração Científica, focando na ênfase nas tarefas, racionalização do trabalho e tempos/movimentos.'
  },
  {
    disciplina: 'Marketing',
    dificuldade: 'Médio',
    tipo: 'Mix de Marketing',
    pergunta: 'Quais são os componentes tradicionais dos 4 Ps do Marketing?',
    alternativas: [
      'A) Processo, Pessoas, Preço, Promoção',
      'B) Produto, Preço, Praça, Promoção',
      'C) Planejamento, Pesquisa, Produção, Preço',
      'D) Produto, Performance, Pessoas, Praça',
      'E) Posicionamento, Preço, Praça, Promoção'
    ],
    respostaCorreta: 1, // Índice B
    explicacao: 'Os 4 Ps originais modelados por Jerome McCarthy e difundidos por Philip Kotler são: Produto, Preço, Praça (Distribuição) e Promoção.'
  },
  {
    disciplina: 'Gestão de Pessoas',
    dificuldade: 'Fácil',
    tipo: 'Motivação',
    pergunta: 'Na Pirâmide de Maslow, qual das necessidades está no topo da hierarquia?',
    alternativas: [
      'A) Necessidades Fisiológicas',
      'B) Necessidades de Segurança',
      'C) Necessidades Sociais',
      'D) Necessidades de Estima',
      'E) Necessidades de Autorrealização'
    ],
    respostaCorreta: 4, // Índice E
    explicacao: 'A Autorrealização fica no topo da Pirâmide de Maslow e envolve o crescimento pessoal, alcance do potencial máximo e autonomia.'
  }
];

export async function popularBancoPerguntas() {
  try {
    const questionsRef = collection(db, 'questions');
    for (const q of perguntasIniciais) {
      await addDoc(questionsRef, q);
    }
    return true;
  } catch (error) {
    console.error("Erro ao popular perguntas: ", error);
    return false;
  }
}