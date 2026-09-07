import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  const [abaAtiva, setAbaAtiva] = useState('home');

  // Form Login/Cadastro
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [curso, setCurso] = useState('');
  const [turma, setTurma] = useState('');
  const [unidade, setUnidade] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Quiz & Timer
  const [perguntas, setPerguntas] = useState([]);
  const [perguntasSessao, setPerguntasSessao] = useState([]); // Bloco de até 10 perguntas embaralhadas
  const [perguntasErradasSessao, setPerguntasErradasSessao] = useState([]); // Guarda as erradas para refazer
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(null);
  const [indicePerguntaAtual, setIndicePerguntaAtual] = useState(0);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [respostaConfirmada, setRespostaConfirmada] = useState(false);
  const [pontosSessao, setPontosSessao] = useState(0);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        carregarDadosUsuario(currentUser.uid);
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
      setUserData(docSnap.data());
    }
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
      const q = query(collection(db, 'users'), orderBy('pontuacaoGeral', 'desc'), limit(10));
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
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

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
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('E-mail ou senha incorretos.');
    }
    setLoading(false);
  };

  const handleTornarAdmin = async () => {
    if (!user) return;

    // Trava de Segurança Rígida
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

  const handleResetarRanking = async () => {
    if (window.confirm("Tem certeza que deseja zerar a pontuação de TODOS os alunos no ranking?")) {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        
        const promessas = querySnapshot.docs.map((userDoc) => 
          updateDoc(doc(db, 'users', userDoc.id), { pontuacaoGeral: 0 })
        );

        await Promise.all(promessas);

        alert("Ranking resetado com sucesso!");
        carregarRanking();
        carregarDadosUsuario(user.uid);
      } catch (err) {
        alert("Erro ao resetar ranking: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Prepara o bloco de até 10 questões com alternativas embaralhadas
  const prepararBlocoQuestoes = (listaOrigem, quantidade = 10) => {
    const embaralhadas = shuffleArray(listaOrigem).slice(0, quantidade);
    
    return embaralhadas.map((q) => {
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

    let updatesUsuario = {
      questoesRespondidas: increment(1)
    };

    if (acertou && tempoRestante > 0) {
      updatesUsuario.questoesAcertadas = increment(1);

      if (!isModoRefazer) {
        // Regra de Negócio Padrão: 5 XP (Presença) + 25 XP (Acerto) - 3 XP a cada 10s
        const penalidadeTempo = Math.floor(tempoDecorrido / 10) * 3;
        xpGanho = Math.max(0, (5 + 25) - penalidadeTempo);

        // Lógica de Streak
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
      } else {
        // Refazer: Teto de 15 XP (50% da pontuação máxima)
        const penalidadeTempo = Math.floor(tempoDecorrido / 10) * 3;
        xpGanho = Math.max(0, 15 - penalidadeTempo);
      }
    } else {
      setStreak(0);
      if (!isModoRefazer) {
        setPerguntasErradasSessao((prev) => [...prev, perguntaAtual]);
      }
    }

    if (xpGanho > 0) {
      updatesUsuario.pontuacaoGeral = increment(xpGanho);
    }

    setXpUltimaQuestao(xpGanho);
    setPontosSessao((prev) => prev + xpGanho);

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, updatesUsuario);
    carregarDadosUsuario(user.uid);
    carregarRanking();
  };

  const handleProximaPergunta = async () => {
    if (indicePerguntaAtual + 1 < perguntasSessao.length) {
      setIndicePerguntaAtual((prev) => prev + 1);
      setOpcaoSelecionada(null);
      setRespostaConfirmada(false);
      setTempoRestante(TEMPO_LIMITE);
      setMensagemBonus('');
    } else {
      // Concluiu o Quiz (+30 XP Bônus de Finalização do Quiz)
      const userRef = doc(db, 'users', user.uid);
      if (!isModoRefazer) {
        const bonusConclusao = 30;
        setPontosSessao((prev) => prev + bonusConclusao);
        await updateDoc(userRef, { 
          pontuacaoGeral: increment(bonusConclusao),
          quizzesRealizados: increment(1) 
        });
      } else {
        await updateDoc(userRef, { 
          quizzesRealizados: increment(1) 
        });
      }
      await carregarDadosUsuario(user.uid);
      setQuizFinalizado(true);
      carregarRanking();
    }
  };

  // TELA DE QUIZ
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

  // DASHBOARD PRINCIPAL
  if (user && userData) {
    const listaDisciplinas = ['Todas', ...AREAS_ADMINISTRACAO];
    const isUserAdminAutorizado = userData.isAdmin && user.email.toLowerCase() === ADMIN_EMAIL_AUTORIZADO.toLowerCase();

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
        <div className="w-full max-w-xl bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 my-4">
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-indigo-400">Olá, {userData.nome}!</h2>
              <p className="text-xs text-slate-400">{userData.email}</p>
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
                  <span className="text-xs text-slate-400 block">Sua Pontuação Total</span>
                  <span className="text-2xl font-black text-emerald-400">{userData.pontuacaoGeral || 0} XP</span>
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

          {abaAtiva === 'ranking' && (
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                🏆 Top Alunos em Administração
              </h3>

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
                        {aluno.uid === user.uid && <span className="text-[10px] text-indigo-400">(Você)</span>}
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-400">{aluno.pontuacaoGeral || 0} XP</span>
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
                  <span className="text-[11px] text-slate-400 block mb-1">⚡ XP Acumulado</span>
                  <span className="text-2xl font-black text-emerald-400">{userData.pontuacaoGeral || 0} XP</span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 block mb-1">🏆 Posição no Ranking</span>
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

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Quizzes Realizados</span>
                  <span className="font-bold text-slate-200">{userData.quizzesRealizados || 0}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Total de Questões Respondidas</span>
                  <span className="font-bold text-slate-200">{userData.questoesRespondidas || 0}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Questões Acertadas</span>
                  <span className="font-bold text-emerald-400">{userData.questoesAcertadas || 0}</span>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'admin' && isUserAdminAutorizado && (
            <div>
              <button 
                onClick={handleResetarRanking}
                disabled={loading}
                className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold py-2.5 rounded-lg transition mb-6"
              >
                ⚠️ Resetar Pontuação de Todos os Alunos
              </button>

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

  // LOGIN / CADASTRO
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
            <label className="block text-xs text-slate-400 mb-1">Senha</label>
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
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-slate-400 hover:text-indigo-400 transition"
          >
            {isLogin ? 'Ainda não tem conta? Cadastre-se' : 'Já possui conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
}