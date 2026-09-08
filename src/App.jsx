import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  addDoc,
  deleteDoc,
  updateDoc, 
  increment,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { popularBancoPerguntas } from './seedDatabase';

// As 10 Áreas Principais de Administração
const AREAS_ADMINISTRACAO = [
  'Administração e Gestão',
  'Gestão de Pessoas',
  'Gestão Financeira e Contábil',
  'Marketing e Vendas',
  'Empreendedorismo',
  'Materiais e Logística',
  'Produção e Qualidade',
  'Estratégia e Processos',
  'Direito, Legislação e Ética',
  'Tecnologia e Ferramentas Administrativas'
];

// E-mail oficial do Administrador
const ADMIN_EMAIL_AUTORIZADO = "ofeitosa94@gmail.com";

// Tabela Oficial de Conquistas Mensais + Secretas
const CONQUISTAS_SISTEMA = [
  // 📚 Participação
  { id: 'part_1', cat: 'Participação', nome: 'Primeiro Passo', desc: 'Responder 10 questões no mês', icone: '🎯', xp: 30, secreta: false, checar: (u) => (u.questoesRespondidasMes || 0) >= 10 },
  { id: 'part_2', cat: 'Participação', nome: 'Participante', desc: 'Completar 3 quizzes no mês', icone: '📚', xp: 50, secreta: false, checar: (u) => (u.quizzesRealizadosMes || 0) >= 3 },
  { id: 'part_3', cat: 'Participação', nome: 'Ativo', desc: 'Completar 6 quizzes no mês', icone: '⚡', secreta: false, xp: 75, checar: (u) => (u.quizzesRealizadosMes || 0) >= 6 },
  { id: 'part_4', cat: 'Participação', nome: 'Dedicado', desc: 'Completar 10 quizzes no mês', icone: '🔥', secreta: false, xp: 100, checar: (u) => (u.quizzesRealizadosMes || 0) >= 10 },

  // 🎯 Desempenho Geral
  { id: 'des_1', cat: 'Desempenho', nome: 'Primeiro Acerto', desc: 'Acertar 1 questão no mês', icone: '✅', xp: 20, secreta: false, checar: (u) => (u.questoesAcertadasMes || 0) >= 1 },
  { id: 'des_2', cat: 'Desempenho', nome: 'Conhecedor', desc: '25 acertos no mês', icone: '🧠', xp: 50, secreta: false, checar: (u) => (u.questoesAcertadasMes || 0) >= 25 },
  { id: 'des_3', cat: 'Desempenho', nome: 'Bom Desempenho', desc: '50 acertos no mês', icone: '🌟', xp: 75, secreta: false, checar: (u) => (u.questoesAcertadasMes || 0) >= 50 },
  { id: 'des_4', cat: 'Desempenho', nome: 'Especialista', desc: '100 acertos no mês', icone: '🥇', xp: 150, secreta: false, checar: (u) => (u.questoesAcertadasMes || 0) >= 100 },
  { id: 'des_5', cat: 'Desempenho', nome: 'Mestre do Mês', desc: '150 acertos no mês', icone: '👑', xp: 250, secreta: false, checar: (u) => (u.questoesAcertadasMes || 0) >= 150 },

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
  { id: 'sec_1', cat: 'Secreta', nome: 'Velocista ADM', desc: 'Respondeu e acertou uma questão em menos de 5s', icone: '⚡', xp: 100, secreta: true, checar: (_, __, tempoRestante) => tempoRestante >= 55 },
  { id: 'sec_2', cat: 'Secreta', nome: 'Perfeição Absoluta', desc: 'Concluiu um quiz com 100% sem cometer erros', icone: '💎', xp: 200, secreta: true, checar: (_, acertosQuiz) => acertosQuiz === 10 },
  { id: 'sec_3', cat: 'Secreta', nome: 'Coruja da Madrugada', desc: 'Estudou e concluiu um quiz no turno da noite/madrugada', icone: '🦉', xp: 80, secreta: true, checar: () => { const h = new Date().getHours(); return h >= 22 || h < 4; } }
];

// Tabela Oficial de Missões Dinâmicas
const MISSOES_SISTEMA = [
  // 🟢 Diárias
  { id: 'dia_1', tipo: 'Diária', nome: 'Desafio Diário', desc: 'Responda 10 questões hoje', alvo: 10, xp: 30, progresso: (u) => u.progressoMissoes?.questoesHoje || 0 },
  { id: 'dia_2', tipo: 'Diária', nome: 'Desafio Rápido', desc: 'Acerte 5 questões hoje', alvo: 5, xp: 40, progresso: (u) => u.progressoMissoes?.acertosHoje || 0 },

  // 🔵 Semanais
  { id: 'sem_1', tipo: 'Semanal', nome: 'Semana de Estudos', desc: 'Responda 30 questões esta semana', alvo: 30, xp: 100, progresso: (u) => u.progressoMissoes?.questoesSemana || 0 },
  { id: 'sem_2', tipo: 'Semanal', nome: 'Semana Perfeita', desc: 'Complete 3 quizzes com ≥70% de aproveitamento', alvo: 3, xp: 150, progresso: (u) => u.progressoMissoes?.quizzes70pctSemana || 0 },
  { id: 'sem_3', tipo: 'Semanal', nome: 'Explorador Semanal', desc: 'Responda questões em 3 categorias diferentes', alvo: 3, xp: 100, progresso: (u) => (u.progressoMissoes?.categoriasSemana || []).length },

  // 🔴 Mensais
  { id: 'men_1', tipo: 'Mensal', nome: 'Desafio do Mês', desc: 'Responda 100 questões durante o mês', alvo: 100, xp: 300, progresso: (u) => u.questoesRespondidasMes || 0 },
  { id: 'men_2', tipo: 'Mensal', nome: 'Mestre das Categorias', desc: 'Complete um quiz em todas as 10 categorias', alvo: 10, xp: 400, progresso: (u) => (u.progressoMissoes?.quizzes10CategoriasMes || []).length },
  { id: 'men_3', tipo: 'Mensal', nome: 'Consistência', desc: 'Participe em pelo menos 15 dias diferentes no mês', alvo: 15, xp: 300, progresso: (u) => (u.diasAtivosMes || []).length },
  { id: 'men_4', tipo: 'Mensal', nome: 'Excelência', desc: 'Mantenha média de acertos superior a 80% no mês (Min. 50 qst)', alvo: 80, xp: 500, progresso: (u) => u.questoesRespondidasMes >= 50 ? Math.round((u.questoesAcertadasMes / u.questoesRespondidasMes) * 100) : 0 }
];

// Algoritmo Fisher-Yates para embaralhar listas
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('home');

  // Form Login/Cadastro/Reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [curso, setCurso] = useState('');
  const [turma, setTurma] = useState('');
  const [unidade, setUnidade] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Quiz & Timer
  const [perguntas, setPerguntas] = useState([]);
  const [perguntasSessao, setPerguntasSessao] = useState([]); 
  const [perguntasErradasSessao, setPerguntasErradasSessao] = useState([]); 
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(null);
  const [indicePerguntaAtual, setIndicePerguntaAtual] = useState(0);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [respostaConfirmada, setRespostaConfirmada] = useState(false);
  const [pontosSessao, setPontosSessao] = useState(0);
  const [acertosSessao, setAcertosSessao] = useState(0);
  const [quizFinalizado, setQuizFinalizado] = useState(false);
  const [isModoRefazer, setIsModoRefazer] = useState(false);
  
  // Gamificação & Streaks
  const [streak, setStreak] = useState(0);
  const [mensagemBonus, setMensagemBonus] = useState('');
  const [xpUltimaQuestao, setXpUltimaQuestao] = useState(0);

  const TEMPO_LIMITE = 60; 
  const [tempoRestante, setTempoRestante] = useState(TEMPO_LIMITE);

  // Ranking
  const [rankingAlunos, setRankingAlunos] = useState([]);

  // Form Admin
  const [novaDisciplina, setNovaDisciplina] = useState(AREAS_ADMINISTRACAO[0]);
  const [novaDificuldade, setNovaDificuldade] = useState('Médio');
  const [novoTipo, setNovoTipo] = useState('');
  const [novaPergunta, setNovaPergunta] = useState('');
  const [altA, setAltA] = useState('');
  const [altB, setAltB] = useState('');
  const [altC, setAltC] = useState('');
  const [altD, setAltD] = useState('');
  const [altE, setAltE] = useState('');
  const [respostaCorretaIndex, setRespostaCorretaIndex] = useState(0);
  const [novaExplicacao, setNovaExplicacao] = useState('');
  const [nomeNovaTemporada, setNomeNovaTemporada] = useState('OUTUBRO/2026');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await carregarDadosUsuario(currentUser.uid);
        carregarPerguntas();
        carregarRanking();
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timer;
    if (disciplinaSelecionada && !respostaConfirmada && !quizFinalizado && tempoRestante > 0) {
      timer = setInterval(() => {
        setTempoRestante((prev) => prev - 1);
      }, 1000);
    } else if (tempoRestante === 0 && !respostaConfirmada && disciplinaSelecionada && !quizFinalizado) {
      handleConfirmarResposta();
    }
    return () => clearInterval(timer);
  }, [disciplinaSelecionada, respostaConfirmada, quizFinalizado, tempoRestante]);

  const carregarDadosUsuario = async (uid) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();

      const hoje = new Date().toISOString().split('T')[0];
      const diasAtivos = data.diasAtivosMes || [];
      const ultimoDiaAtivo = data.ultimoDiaAtivo || '';
      
      let updates = {};

      if (!diasAtivos.includes(hoje)) {
        updates.diasAtivosMes = [...diasAtivos, hoje];
        data.diasAtivosMes = updates.diasAtivosMes;
      }

      // Se virou o dia, reseta histórico diário de acertos, erros e progresso das missões diárias
      if (ultimoDiaAtivo !== hoje) {
        updates.ultimoDiaAtivo = hoje;
        updates.questoesRespondidasHoje = [];
        updates.questoesErradasHoje = [];
        updates["progressoMissoes.questoesHoje"] = 0;
        updates["progressoMissoes.acertosHoje"] = 0;

        data.ultimoDiaAtivo = hoje;
        data.questoesRespondidasHoje = [];
        data.questoesErradasHoje = [];
        data.progressoMissoes = {
          ...(data.progressoMissoes || {}),
          questoesHoje: 0,
          acertosHoje: 0
        };
      }

      // Garante que o objeto progressoMissoes exista para contas legadas
      if (!data.progressoMissoes) {
        updates.progressoMissoes = {
          questoesHoje: 0,
          acertosHoje: 0,
          questoesSemana: 0,
          quizzes70pctSemana: 0,
          categoriasSemana: [],
          quizzes10CategoriasMes: []
        };
        data.progressoMissoes = updates.progressoMissoes;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(docRef, updates);
      }

      setUserData(data);
      return data;
    }
    return null;
  };

  const carregarPerguntas = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'));
      const lista = [];
      querySnapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setPerguntas(lista);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const carregarRanking = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('xpTemporada', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const ranking = [];
      querySnapshot.forEach((doc) => {
        ranking.push(doc.data());
      });
      setRankingAlunos(ranking);
    } catch (err) {
      console.error("Erro ao carregar ranking:", err);
    }
  };

  const checarEConcederConquistas = async (dadosAtualizados, acertosQuizAtual = -1, tempoDaQuestao = 0) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    let xpGeralAdd = 0;

    const conquistasAtuais = dadosAtualizados.conquistasDesbloqueadas || [];
    const novasConquistas = [];

    CONQUISTAS_SISTEMA.forEach((conquista) => {
      if (!conquistasAtuais.includes(conquista.id)) {
        if (conquista.checar(dadosAtualizados, acertosQuizAtual, tempoDaQuestao)) {
          novasConquistas.push(conquista.id);
          xpGeralAdd += conquista.xp;
        }
      }
    });

    const missoesConcluidasAtuais = dadosAtualizados.missoesConcluidas || [];
    const novasMissoesCompletas = [];

    MISSOES_SISTEMA.forEach((missao) => {
      if (!missoesConcluidasAtuais.includes(missao.id)) {
        const valorAtual = missao.progresso(dadosAtualizados);
        if (valorAtual >= missao.alvo) {
          novasMissoesCompletas.push(missao.id);
          xpGeralAdd += missao.xp;
        }
      }
    });

    if (novasConquistas.length > 0 || novasMissoesCompletas.length > 0) {
      await updateDoc(userRef, {
        conquistasDesbloqueadas: [...conquistasAtuais, ...novasConquistas],
        missoesConcluidas: [...missoesConcluidasAtuais, ...novasMissoesCompletas],
        xpTemporada: increment(xpGeralAdd),
        pontuacaoGeral: increment(xpGeralAdd)
      });

      let msg = '🎉 PARABÉNS!\n';
      if (novasMissoesCompletas.length > 0) msg += `🎯 ${novasMissoesCompletas.length} Missão(ões) Cumprida(s)!\n`;
      if (novasConquistas.length > 0) msg += `🏆 ${novasConquistas.length} Conquista(s) Desbloqueada(s)!\n`;
      msg += `+${xpGeralAdd} XP creditados!`;

      alert(msg);
      await carregarDadosUsuario(user.uid);
    }
  };

  const handleSeed = async () => {
    setLoading(true);
    const ok = await popularBancoPerguntas();
    if (ok) {
      alert("Perguntas de exemplo adicionadas com sucesso!");
      carregarPerguntas();
    } else {
      alert("Erro ao popular banco de dados.");
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      const hoje = new Date().toISOString().split('T')[0];

      const newUserData = {
        uid: newUser.uid,
        nome: nome,
        email: email,
        curso: curso,
        turma: turma,
        unidade: unidade,
        
        pontuacaoGeral: 0,
        quizzesRealizados: 0,
        questoesRespondidas: 0,
        questoesAcertadas: 0,
        maiorSequencia: 0,
        
        xpTemporada: 0,
        quizzesRealizadosMes: 0,
        questoesRespondidasMes: 0,
        questoesAcertadasMes: 0,
        categoriasRespondidas: {},
        conquistasDesbloqueadas: [],
        missoesConcluidas: [],
        diasAtivosMes: [hoje],
        ultimoDiaAtivo: hoje,
        questoesRespondidasHoje: [],
        questoesErradasHoje: [],
        temporadaAtual: "SETEMBRO/2026",

        progressoMissoes: {
          questoesHoje: 0,
          acertosHoje: 0,
          questoesSemana: 0,
          quizzes70pctSemana: 0,
          categoriasSemana: [],
          quizzes10CategoriasMes: []
        },

        isAdmin: email.toLowerCase() === ADMIN_EMAIL_AUTORIZADO.toLowerCase()
      };

      await setDoc(doc(db, 'users', newUser.uid), newUserData);
      setUserData(newUserData);
    } catch (err) {
      setError('Erro ao criar conta: ' + err.message);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('E-mail ou senha incorretos.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email) {
      setError('Digite seu e-mail para continuar.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada ou spam.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('E-mail não encontrado no sistema.');
      } else {
        setError('Erro ao enviar e-mail de redefinição. Verifique se o e-mail está correto.');
      }
    }
    setLoading(false);
  };

  const handleTornarAdmin = async () => {
    if (!user) return;

    if (user.email.toLowerCase() !== ADMIN_EMAIL_AUTORIZADO.toLowerCase()) {
      alert("Acesso negado: Apenas a conta oficial (ofeitosa94@gmail.com) tem permissão de Administrador.");
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isAdmin: true });
      carregarDadosUsuario(user.uid);
      alert("Perfil atualizado para Administrador com sucesso!");
    } catch (err) {
      alert("Erro ao atualizar perfil: " + err.message);
    }
  };

  const handleImportarJSON = (event) => {
    const fileReader = new FileReader();
    const file = event.target.files[0];

    if (!file) return;

    fileReader.onload = async (e) => {
      try {
        const conteudo = JSON.parse(e.target.result);

        if (!Array.isArray(conteudo)) {
          alert("Erro: O arquivo enviado precisa conter uma lista (array) de questões.");
          return;
        }

        setLoading(true);
        let importadas = 0;
        
        for (const q of conteudo) {
          if (q.pergunta && q.alternativas && q.disciplina) {
            await addDoc(collection(db, 'questions'), q);
            importadas++;
          }
        }
        
        alert(`Sucesso! ${importadas} questões foram importadas para o banco de dados.`);
        carregarPerguntas();
      } catch (err) {
        alert("Erro ao ler arquivo JSON: " + err.message);
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    };

    fileReader.readAsText(file);
  };

  const handleCadastrarPergunta = async (e) => {
    e.preventDefault();
    if (!altA || !altB || !altC || !altD || !altE) {
      alert("Preencha todas as 5 alternativas.");
      return;
    }

    const novaQ = {
      disciplina: novaDisciplina,
      dificuldade: novaDificuldade,
      tipo: novoTipo || 'Geral',
      pergunta: novaPergunta,
      alternativas: [
        `A) ${altA}`,
        `B) ${altB}`,
        `C) ${altC}`,
        `D) ${altD}`,
        `E) ${altE}`
      ],
      respostaCorreta: Number(respostaCorretaIndex),
      explicacao: novaExplicacao
    };

    try {
      await addDoc(collection(db, 'questions'), novaQ);
      alert("Questão cadastrada com sucesso!");
      setNovaPergunta('');
      setNovoTipo('');
      setAltA(''); setAltB(''); setAltC(''); setAltD(''); setAltE('');
      setNovaExplicacao('');
      carregarPerguntas();
    } catch (err) {
      alert("Erro ao cadastrar pergunta: " + err.message);
    }
  };

  const handleDeletarPergunta = async (id) => {
    if (window.confirm("Deseja realmente apagar esta pergunta?")) {
      try {
        await deleteDoc(doc(db, 'questions', id));
        carregarPerguntas();
      } catch (err) {
        alert("Erro ao excluir: " + err.message);
      }
    }
  };

  const handleEncerrarTemporada = async () => {
    if (!nomeNovaTemporada) {
      alert("Informe o nome da nova temporada (Ex: OUTUBRO/2026).");
      return;
    }

    if (window.confirm(`Tem certeza que deseja encerrar a temporada atual e iniciar a temporada ${nomeNovaTemporada}? O XP, missões e conquistas mensais de TODOS os alunos serão resetados.`)) {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        
        const promessas = querySnapshot.docs.map((userDoc) => 
          updateDoc(doc(db, 'users', userDoc.id), {
            xpTemporada: 0,
            quizzesRealizadosMes: 0,
            questoesRespondidasMes: 0,
            questoesAcertadasMes: 0,
            categoriasRespondidas: {},
            conquistasDesbloqueadas: [],
            missoesConcluidas: [],
            diasAtivosMes: [],
            temporadaAtual: nomeNovaTemporada,
            "progressoMissoes.quizzes10CategoriasMes": []
          })
        );

        await Promise.all(promessas);

        alert(`Temporada ${nomeNovaTemporada} iniciada com sucesso!`);
        carregarRanking();
        await carregarDadosUsuario(user.uid);
      } catch (err) {
        alert("Erro ao zerar temporada: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const prepararBlocoQuestoes = (listaOrigem, quantidade = 10) => {
    const erradasHojeIds = userData?.questoesErradasHoje || [];
    const respondidasHojeIds = userData?.questoesRespondidasHoje || [];

    const naoRespondidasHoje = listaOrigem.filter(q => !respondidasHojeIds.includes(q.id));
    const acertadasHoje = listaOrigem.filter(q => respondidasHojeIds.includes(q.id) && !erradasHojeIds.includes(q.id));
    const erradasHoje = listaOrigem.filter(q => erradasHojeIds.includes(q.id));

    const grupo1 = shuffleArray(naoRespondidasHoje);
    const grupo2 = shuffleArray(acertadasHoje);
    const grupo3 = shuffleArray(erradasHoje);

    const listaOrdenada = [...grupo1, ...grupo2, ...grupo3].slice(0, quantidade);
    
    return listaOrdenada.map((q) => {
      const altsComIndice = q.alternativas.map((texto, idx) => ({
        texto,
        isCorreta: idx === q.respostaCorreta
      }));

      const altsEmbaralhadas = shuffleArray(altsComIndice);
      const novoIndexCorreto = altsEmbaralhadas.findIndex(a => a.isCorreta);

      return {
        ...q,
        alternativas: altsEmbaralhadas.map(a => a.texto),
        respostaCorreta: novoIndexCorreto
      };
    });
  };

  const iniciarQuizPorDisciplina = (disc) => {
    const filtradas = perguntas.filter(
      (q) => disc === 'Todas' || q.disciplina === disc
    );

    const blocoPronto = prepararBlocoQuestoes(filtradas, 10);

    setDisciplinaSelecionada(disc);
    setPerguntasSessao(blocoPronto);
    setPerguntasErradasSessao([]);
    setIndicePerguntaAtual(0);
    setOpcaoSelecionada(null);
    setRespostaConfirmada(false);
    setPontosSessao(0);
    setAcertosSessao(0);
    setStreak(0);
    setIsModoRefazer(false);
    setQuizFinalizado(false);
    setTempoRestante(TEMPO_LIMITE);
    setMensagemBonus('');
  };

  const refazerQuestoesErradas = () => {
    const blocoPronto = prepararBlocoQuestoes(perguntasErradasSessao, perguntasErradasSessao.length);

    setPerguntasSessao(blocoPronto);
    setPerguntasErradasSessao([]);
    setIndicePerguntaAtual(0);
    setOpcaoSelecionada(null);
    setRespostaConfirmada(false);
    setStreak(0);
    setIsModoRefazer(true);
    setQuizFinalizado(false);
    setTempoRestante(TEMPO_LIMITE);
    setMensagemBonus('');
  };

  const sairDoQuiz = () => {
    if (window.confirm("Deseja realmente sair do simulado? Seu progresso nesta sessão será encerrado.")) {
      setDisciplinaSelecionada(null);
      setQuizFinalizado(false);
    }
  };

  const perguntaAtual = perguntasSessao[indicePerguntaAtual];

  const handleConfirmarResposta = async () => {
    setRespostaConfirmada(true);
    setMensagemBonus('');
    
    let xpGanho = 0;
    const tempoDecorrido = TEMPO_LIMITE - tempoRestante;
    const acertou = opcaoSelecionada === perguntaAtual.respostaCorreta;
    const discAtual = perguntaAtual.disciplina;
    const qId = perguntaAtual.id;

    const respondidasHoje = userData?.questoesRespondidasHoje || [];
    const erradasHoje = userData?.questoesErradasHoje || [];
    const jaRespondidaHoje = respondidasHoje.includes(qId);

    const contagemCategorias = { ...(userData?.categoriasRespondidas || {}) };
    contagemCategorias[discAtual] = (contagemCategorias[discAtual] || 0) + 1;

    const catSemanaAtual = userData?.progressoMissoes?.categoriasSemana || [];
    const novasCatSemana = catSemanaAtual.includes(discAtual) ? catSemanaAtual : [...catSemanaAtual, discAtual];

    const novasRespondidasHoje = jaRespondidaHoje ? respondidasHoje : [...respondidasHoje, qId];
    let novasErradasHoje = [...erradasHoje];

    let updatesUsuario = {
      questoesRespondidas: increment(1),
      questoesRespondidasMes: increment(1),
      categoriasRespondidas: contagemCategorias,
      questoesRespondidasHoje: novasRespondidasHoje,
      "progressoMissoes.questoesHoje": increment(1),
      "progressoMissoes.questoesSemana": increment(1),
      "progressoMissoes.categoriasSemana": novasCatSemana
    };

    if (acertou && tempoRestante > 0) {
      setAcertosSessao((prev) => prev + 1);
      updatesUsuario.questoesAcertadas = increment(1);
      updatesUsuario.questoesAcertadasMes = increment(1);
      updatesUsuario["progressoMissoes.acertosHoje"] = increment(1);

      novasErradasHoje = novasErradasHoje.filter(id => id !== qId);

      if (!isModoRefazer) {
        const penalidadeTempo = Math.floor(tempoDecorrido / 10) * 3;
        let xpBase = Math.max(0, 30 - penalidadeTempo);

        if (jaRespondidaHoje) {
          xpGanho = Math.floor(xpBase / 2);
          setMensagemBonus('⚠️ Questão repetida hoje: Metade dos pontos (sem bônus de sequência).');
        } else {
          xpGanho = xpBase;
          const novoStreak = streak + 1;
          setStreak(novoStreak);

          if (novoStreak > (userData?.maiorSequencia || 0)) {
            updatesUsuario.maiorSequencia = novoStreak;
          }

          if (novoStreak === 3) {
            xpGanho += 20;
            setMensagemBonus('🔥 Sequência de 3 acertos! (+20 XP)');
          } else if (novoStreak === 5) {
            xpGanho += 50;
            setMensagemBonus('⚡ Sequência Incrível de 5 acertos! (+50 XP)');
          }
        }
      } else {
        const penalidadeTempo = Math.floor(tempoDecorrido / 10) * 3;
        xpGanho = Math.max(0, 15 - penalidadeTempo);
      }
    } else {
      setStreak(0);
      if (!novasErradasHoje.includes(qId)) {
        novasErradasHoje.push(qId);
      }
      if (!isModoRefazer) {
        setPerguntasErradasSessao((prev) => [...prev, perguntaAtual]);
      }
    }

    updatesUsuario.questoesErradasHoje = novasErradasHoje;

    if (xpGanho > 0) {
      updatesUsuario.pontuacaoGeral = increment(xpGanho);
      updatesUsuario.xpTemporada = increment(xpGanho);
    }

    setXpUltimaQuestao(xpGanho);
    setPontosSessao((prev) => prev + xpGanho);

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, updatesUsuario);
    const dadosNovos = await carregarDadosUsuario(user.uid);
    carregarRanking();

    await checarEConcederConquistas(dadosNovos, -1, tempoRestante);
  };

  const handleProximaPergunta = async () => {
    if (indicePerguntaAtual + 1 < perguntasSessao.length) {
      setIndicePerguntaAtual((prev) => prev + 1);
      setOpcaoSelecionada(null);
      setRespostaConfirmada(false);
      setTempoRestante(TEMPO_LIMITE);
      setMensagemBonus('');
    } else {
      const userRef = doc(db, 'users', user.uid);
      const aproveitamentoQuiz = (acertosSessao / perguntasSessao.length) * 100;

      let payloadFinalQuiz = { 
        quizzesRealizados: increment(1),
        quizzesRealizadosMes: increment(1)
      };

      if (!isModoRefazer) {
        const bonusConclusao = 30;
        setPontosSessao((prev) => prev + bonusConclusao);
        payloadFinalQuiz.pontuacaoGeral = increment(bonusConclusao);
        payloadFinalQuiz.xpTemporada = increment(bonusConclusao);

        if (aproveitamentoQuiz >= 70) {
          payloadFinalQuiz["progressoMissoes.quizzes70pctSemana"] = increment(1);
        }

        const cat10Mes = userData?.progressoMissoes?.quizzes10CategoriasMes || [];
        if (disciplinaSelecionada && disciplinaSelecionada !== 'Todas' && !cat10Mes.includes(disciplinaSelecionada)) {
          payloadFinalQuiz["progressoMissoes.quizzes10CategoriasMes"] = [...cat10Mes, disciplinaSelecionada];
        }
      }

      await updateDoc(userRef, payloadFinalQuiz);
      const dadosNovos = await carregarDadosUsuario(user.uid);
      setQuizFinalizado(true);
      carregarRanking();

      await checarEConcederConquistas(dadosNovos, acertosSessao);
    }
  };

  if (user && userData && disciplinaSelecionada) {
    if (perguntasSessao.length === 0) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-md">
            <p className="text-slate-300 mb-4">Nenhuma pergunta cadastrada na área "{disciplinaSelecionada}" ainda.</p>
            <button 
              onClick={() => setDisciplinaSelecionada(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm"
            >
              Voltar ao Menu
            </button>
          </div>
        </div>
      );
    }

    if (quizFinalizado) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 text-center">
            <span className="text-5xl mb-4 block">🏆</span>
            <h2 className="text-2xl font-bold text-indigo-400 mb-2">Quiz Concluído!</h2>
            <p className="text-slate-400 text-sm mb-6">
              {!isModoRefazer ? 'Você ganhou +30 XP bônus por finalizar o quiz!' : 'Revisão das questões erradas concluída!'}
            </p>
            
            <div className="bg-slate-700/50 p-4 rounded-xl mb-6 border border-slate-600">
              <span className="text-xs text-slate-400 block mb-1">XP Total Ganho nesta Sessão</span>
              <span className="text-3xl font-black text-emerald-400">+{pontosSessao} XP</span>
              <span className="text-xs text-slate-400 block mt-2">Acertos: {acertosSessao} de {perguntasSessao.length}</span>
            </div>

            {perguntasErradasSessao.length > 0 && !isModoRefazer && (
              <button 
                onClick={refazerQuestoesErradas}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 rounded-lg transition mb-3"
              >
                🔄 Refazer Erradas ({perguntasErradasSessao.length}) - Máx 15 XP
              </button>
            )}

            <button 
              onClick={() => setDisciplinaSelecionada(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 mt-6">
          
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {perguntaAtual.disciplina} {isModoRefazer && '(Refazendo)'}
            </span>
            
            <div className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
              tempoRestante <= 10 
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                : 'bg-slate-700 text-amber-400 border-slate-600'
            }`}>
              ⏱️ {tempoRestante}s
            </div>

            <button
              onClick={sairDoQuiz}
              className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-500/30 transition"
            >
              🚪 Sair
            </button>
          </div>

          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Progresso {indicePerguntaAtual + 1} de {perguntasSessao.length}</span>
            <span>🔥 Combo: {streak}</span>
          </div>

          <div className="w-full bg-slate-700 h-1.5 rounded-full mb-4 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                tempoRestante <= 10 ? 'bg-red-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${(tempoRestante / TEMPO_LIMITE) * 100}%` }}
            ></div>
          </div>

          <div className="flex gap-2 mb-4">
            <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">
              Dificuldade: {perguntaAtual.dificuldade}
            </span>
            {perguntaAtual.tipo && (
              <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                Tema: {perguntaAtual.tipo}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold mb-6 text-slate-100 leading-relaxed">
            {perguntaAtual.pergunta}
          </h3>

          <div className="space-y-3 mb-6">
            {perguntaAtual.alternativas.map((alt, index) => {
              let btnEstilo = "bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200";
              
              if (opcaoSelecionada === index) {
                btnEstilo = "bg-indigo-950 border-indigo-500 text-white";
              }

              if (respostaConfirmada) {
                if (index === perguntaAtual.respostaCorreta) {
                  btnEstilo = "bg-emerald-950/80 border-emerald-500 text-emerald-200 font-medium";
                } else if (opcaoSelecionada === index) {
                  btnEstilo = "bg-red-950/80 border-red-500 text-red-200";
                }
              }

              return (
                <button
                  key={index}
                  disabled={respostaConfirmada}
                  onClick={() => setOpcaoSelecionada(index)}
                  className={`w-full text-left p-3.5 rounded-xl border transition text-sm flex items-center justify-between ${btnEstilo}`}
                >
                  <span>{alt}</span>
                </button>
              );
            })}
          </div>

          {respostaConfirmada && (
            <div className="mb-6 p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-emerald-400 text-sm">
                  +{xpUltimaQuestao} XP Conquistados
                </span>
                {mensagemBonus && (
                  <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {mensagemBonus}
                  </span>
                )}
              </div>
              {tempoRestante === 0 && (
                <span className="font-bold text-red-400 block mb-1">⚠️ Tempo Esgotado! (0 XP)</span>
              )}
              <span className="font-bold text-indigo-400 block mb-1">📘 Explicação / Revisão:</span>
              <p className="text-slate-300 leading-relaxed">{perguntaAtual.explicacao}</p>
            </div>
          )}

          {!respostaConfirmada ? (
            <button
              onClick={handleConfirmarResposta}
              disabled={opcaoSelecionada === null}
              className="w-full bg-indigo-600 disabled:opacity-50 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition"
            >
              Responder
            </button>
          ) : (
            <button
              onClick={handleProximaPergunta}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition"
            >
              {indicePerguntaAtual + 1 < perguntasSessao.length ? 'Próxima Pergunta' : 'Ver Resultado'}
            </button>
          )}

        </div>
      </div>
    );
  }

  if (user && userData) {
    const listaDisciplinas = ['Todas', ...AREAS_ADMINISTRACAO];
    const isUserAdminAutorizado = userData.isAdmin && user.email.toLowerCase() === ADMIN_EMAIL_AUTORIZADO.toLowerCase();
    const conquistasDesbloqueadas = userData.conquistasDesbloqueadas || [];
    const missoesConcluidas = userData.missoesConcluidas || [];

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
        <div className="w-full max-w-xl bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 my-4">
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-indigo-400">Olá, {userData.nome}!</h2>
              <p className="text-xs text-slate-400">{userData.email}</p>
              <span className="inline-block mt-1 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                🗓️ Temporada: {userData.temporadaAtual || 'SETEMBRO/2026'}
              </span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="bg-red-500/10 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition"
            >
              Sair
            </button>
          </div>

          <div className="flex gap-2 mb-6 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
            <button 
              onClick={() => setAbaAtiva('home')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${abaAtiva === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              📚 Quiz
            </button>
            <button 
              onClick={() => setAbaAtiva('missoes')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${abaAtiva === 'missoes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              🎯 Missões
            </button>
            <button 
              onClick={() => { setAbaAtiva('ranking'); carregarRanking(); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${abaAtiva === 'ranking' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              🏆 Ranking
            </button>
            <button 
              onClick={() => setAbaAtiva('perfil')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${abaAtiva === 'perfil' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              👤 Perfil
            </button>
            {isUserAdminAutorizado && (
              <button 
                onClick={() => setAbaAtiva('admin')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${abaAtiva === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                ⚙️ Admin
              </button>
            )}
          </div>

          {abaAtiva === 'home' && (
            <div>
              <div className="bg-slate-700/40 p-4 rounded-xl border border-slate-600 flex justify-between items-center mb-6">
                <div>
                  <span className="text-xs text-slate-400 block">XP Mensal ({userData.temporadaAtual || 'Temporada'})</span>
                  <span className="text-2xl font-black text-emerald-400">{userData.xpTemporada || 0} XP</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Vitalício: {userData.pontuacaoGeral || 0} XP</span>
                </div>
                {perguntas.length === 0 && (
                  <button 
                    onClick={handleSeed}
                    className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-2 rounded-lg"
                  >
                    + Carregar Perguntas
                  </button>
                )}
                {!userData.isAdmin && user.email.toLowerCase() === ADMIN_EMAIL_AUTORIZADO.toLowerCase() && (
                  <button 
                    onClick={handleTornarAdmin}
                    className="bg-amber-600/20 border border-amber-500/30 text-amber-300 text-[11px] px-2.5 py-1 rounded-lg hover:bg-amber-600/30 transition"
                  >
                    Ativar Modo Admin
                  </button>
                )}
              </div>

              <h3 className="text-sm font-semibold text-slate-300 mb-3">Escolha uma Área da Administração:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {listaDisciplinas.map((disc, idx) => (
                  <button
                    key={idx}
                    onClick={() => iniciarQuizPorDisciplina(disc)}
                    className="w-full bg-slate-900 hover:bg-slate-700/80 border border-slate-700 p-3.5 rounded-xl text-left flex justify-between items-center transition"
                  >
                    <span className="text-sm font-medium text-slate-200">{disc}</span>
                    <span className="text-xs text-indigo-400 font-semibold">Jogar →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'missoes' && (
            <div className="space-y-6">
              {['Diária', 'Semanal', 'Mensal'].map((categoriaTipo) => (
                <div key={categoriaTipo} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                    {categoriaTipo === 'Diária' ? '🟢 Missões Diárias' : categoriaTipo === 'Semanal' ? '🔵 Missões Semanais' : '🔴 Missões Mensais'}
                  </h4>

                  <div className="space-y-2.5">
                    {MISSOES_SISTEMA.filter(m => m.tipo === categoriaTipo).map((missao) => {
                      const concluida = missoesConcluidas.includes(missao.id);
                      const valorProgresso = Math.min(missao.progresso(userData), missao.alvo);
                      const pct = Math.round((valorProgresso / missao.alvo) * 100);

                      return (
                        <div key={missao.id} className={`p-3 rounded-lg border text-xs ${concluida ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-slate-800/80 border-slate-700'}`}>
                          <div className="flex justify-between items-start mb-1.5">
                            <div>
                              <span className={`font-bold block ${concluida ? 'text-emerald-300 line-through' : 'text-slate-200'}`}>
                                {concluida ? '☑' : '☐'} {missao.nome}
                              </span>
                              <p className="text-[11px] text-slate-400">{missao.desc}</p>
                            </div>
                            <span className="font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              +{missao.xp} XP
                            </span>
                          </div>

                          {!concluida && (
                            <div className="mt-2">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>Progresso</span>
                                <span>{valorProgresso} / {missao.alvo}</span>
                              </div>
                              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {abaAtiva === 'ranking' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  🏆 Top Alunos - {userData.temporadaAtual || 'Temporada Atual'}
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  Ordenado por XP Mensal
                </span>
              </div>

              <div className="space-y-2">
                {rankingAlunos.map((aluno, index) => (
                  <div 
                    key={index}
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${aluno.uid === user.uid ? 'bg-indigo-950/60 border-indigo-500' : 'bg-slate-900 border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-amber-500 text-slate-950' : index === 1 ? 'bg-slate-300 text-slate-950' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {index + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-200 block">{aluno.nome}</span>
                        <div className="flex gap-2">
                          {aluno.uid === user.uid && <span className="text-[10px] text-indigo-400 font-bold">(Você)</span>}
                          <span className="text-[10px] text-slate-400">Total: {aluno.pontuacaoGeral || 0} XP</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400">{aluno.xpTemporada || 0} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'perfil' && (
            <div className="space-y-4">
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-inner">
                  {userData.nome ? userData.nome.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{userData.nome}</h3>
                  <p className="text-xs text-slate-400">{userData.curso || 'Curso não informado'} • Turma {userData.turma || '-'}</p>
                  <p className="text-[11px] text-indigo-400 font-medium">📍 {userData.unidade || 'Unidade não informada'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 block mb-1">⚡ XP Temporada</span>
                  <span className="text-2xl font-black text-emerald-400">{userData.xpTemporada || 0} XP</span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 block mb-1">👑 Pos. Temporada</span>
                  <span className="text-2xl font-black text-amber-400">
                    #{rankingAlunos.findIndex(a => a.uid === user.uid) !== -1 
                      ? rankingAlunos.findIndex(a => a.uid === user.uid) + 1 
                      : '-'}
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 block mb-1">🎯 Taxa de Acerto</span>
                  <span className="text-2xl font-black text-indigo-400">
                    {userData.questoesRespondidas > 0 
                      ? ((userData.questoesAcertadas / userData.questoesRespondidas) * 100).toFixed(1) 
                      : 0}%
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 block mb-1">🔥 Maior Sequência</span>
                  <span className="text-2xl font-black text-orange-400">{userData.maiorSequencia || 0} seguidas</span>
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-200">🏆 Conquistas Mensais & Secretas ({conquistasDesbloqueadas.length}/{CONQUISTAS_SISTEMA.length})</h4>
                  <span className="text-[10px] text-slate-400">Reinicia no fim do mês</span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {CONQUISTAS_SISTEMA.map((item) => {
                    const possui = conquistasDesbloqueadas.includes(item.id);
                    return (
                      <div 
                        key={item.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 transition ${
                          possui 
                            ? 'bg-indigo-950/70 border-indigo-500/50 text-slate-100' 
                            : 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60'
                        }`}
                      >
                        <span className="text-2xl">{possui ? item.icone : '🔒'}</span>
                        <div className="overflow-hidden">
                          <span className={`font-bold block truncate ${possui ? 'text-indigo-300' : 'text-slate-400'}`}>
                            {item.secreta && !possui ? 'Conquista Secreta' : item.nome}
                          </span>
                          <p className="text-[10px] leading-tight text-slate-400 truncate">
                            {item.secreta && !possui ? 'Descubra como desbloquear.' : item.desc}
                          </p>
                          <span className="text-[9px] font-black text-emerald-400">+{item.xp} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">XP Vitalício (Total Histórico)</span>
                  <span className="font-bold text-emerald-400">{userData.pontuacaoGeral || 0} XP</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Quizzes Realizados (Geral)</span>
                  <span className="font-bold text-slate-200">{userData.quizzesRealizados || 0}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Total de Questões Respondidas</span>
                  <span className="font-bold text-slate-200">{userData.questoesRespondidas || 0}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Questões Acertadas (Geral)</span>
                  <span className="font-bold text-emerald-400">{userData.questoesAcertadas || 0}</span>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'admin' && isUserAdminAutorizado && (
            <div>
              <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/30 mb-6">
                <h4 className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1">
                  🗓️ Gerenciador de Temporada Mensal
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  Ao encerrar a temporada, o XP do ranking, missões e conquistas mensais são resetados para todos os alunos. O histórico geral e estatísticas acumuladas permanecem intactos.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={nomeNovaTemporada}
                    onChange={(e) => setNomeNovaTemporada(e.target.value)}
                    placeholder="Ex: OUTUBRO/2026"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs flex-1"
                  />
                  <button 
                    onClick={handleEncerrarTemporada}
                    disabled={loading}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition"
                  >
                    Encerrar e Reiniciar
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/30 mb-6">
                <h4 className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
                  📥 Importação em Massa (Arquivo JSON)
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  Envie arquivos `.json` especificando a `disciplina` com um dos nomes das 10 áreas.
                </p>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImportarJSON}
                  disabled={loading}
                  className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <h3 className="text-sm font-bold text-slate-200 mb-4">Ou Cadastrar Pergunta Manualmente</h3>
              
              <form onSubmit={handleCadastrarPergunta} className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-700 mb-6">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Área / Disciplina</label>
                    <select 
                      value={novaDisciplina} 
                      onChange={(e) => setNovaDisciplina(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    >
                      {AREAS_ADMINISTRACAO.map((area, i) => (
                        <option key={i} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Dificuldade</label>
                    <select 
                      value={novaDificuldade} 
                      onChange={(e) => setNovaDificuldade(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    >
                      <option>Fácil</option>
                      <option>Médio</option>
                      <option>Difícil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tema / Assunto Especial</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Teoria Neoclássica, SWOT, 5S..." 
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Enunciado da Pergunta</label>
                  <textarea 
                    required 
                    rows={2}
                    value={novaPergunta}
                    onChange={(e) => setNovaPergunta(e.target.value)}
                    placeholder="Digite a pergunta..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400">Alternativas (A até E):</label>
                  <input type="text" required placeholder="Opção A" value={altA} onChange={(e) => setAltA(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs" />
                  <input type="text" required placeholder="Opção B" value={altB} onChange={(e) => setAltB(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs" />
                  <input type="text" required placeholder="Opção C" value={altC} onChange={(e) => setAltC(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs" />
                  <input type="text" required placeholder="Opção D" value={altD} onChange={(e) => setAltD(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs" />
                  <input type="text" required placeholder="Opção E" value={altE} onChange={(e) => setAltE(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs" />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Qual é a Alternativa Correta?</label>
                  <select 
                    value={respostaCorretaIndex} 
                    onChange={(e) => setRespostaCorretaIndex(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-400"
                  >
                    <option value={0}>Alternativa A</option>
                    <option value={1}>Alternativa B</option>
                    <option value={2}>Alternativa C</option>
                    <option value={3}>Alternativa D</option>
                    <option value={4}>Alternativa E</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Explicação / Revisão Teórica</label>
                  <textarea 
                    required 
                    rows={2}
                    value={novaExplicacao}
                    onChange={(e) => setNovaExplicacao(e.target.value)}
                    placeholder="Explicação exibida quando o aluno responder..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg text-xs transition"
                >
                  Salvar Pergunta no Banco
                </button>
              </form>

              <h4 className="text-xs font-bold text-slate-300 mb-2">Questões no Banco ({perguntas.length}):</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {perguntas.map((q) => (
                  <div key={q.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-semibold block">{q.disciplina} • {q.dificuldade}</span>
                      <p className="text-slate-200 line-clamp-1">{q.pergunta}</p>
                    </div>
                    <button 
                      onClick={() => handleDeletarPergunta(q.id)}
                      className="text-red-400 hover:text-red-300 text-[11px] ml-2 px-2 py-1 bg-red-500/10 rounded"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-indigo-500 tracking-tight">Quiz ADM</h1>
          <p className="text-slate-400 text-sm mt-1">Plataforma de Estudos & Quiz</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <p className="text-xs text-slate-300 mb-4 text-center">
                Digite o seu e-mail cadastrado. Enviaremos um link para você redefinir sua senha.
              </p>
              <label className="block text-xs text-slate-400 mb-1">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition duration-200 mt-2 shadow-lg shadow-indigo-600/30"
            >
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </button>

            <div className="mt-4 text-center">
              <button 
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition"
              >
                ← Voltar para o Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Curso</label>
                  <input 
                    type="text" 
                    required
                    value={curso}
                    onChange={(e) => setCurso(e.target.value)}
                    placeholder="Ex: Administração"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Turma</label>
                    <input 
                      type="text" 
                      required
                      value={turma}
                      onChange={(e) => setTurma(e.target.value)}
                      placeholder="Ex: 3º A"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Unidade</label>
                    <input 
                      type="text" 
                      required
                      value={unidade}
                      onChange={(e) => setUnidade(e.target.value)}
                      placeholder="Ex: Campus Centro"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-400">Senha</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition duration-200 mt-2 shadow-lg shadow-indigo-600/30"
            >
              {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </button>

            <div className="mt-6 text-center">
              <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition"
              >
                {isLogin ? 'Ainda não tem conta? Cadastre-se' : 'Já possui conta? Faça Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}