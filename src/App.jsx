import React, { useState, useEffect, useRef } from 'react';
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
  collection, 
  getDocs, 
  deleteDoc,
  updateDoc, 
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { AREAS_ADMINISTRACAO, normalizeQuestion, prepareQuestions } from './domain/questions';
import { getPeriods, resetPeriods, initialProgress } from './domain/periods';
import { CONQUISTAS_SISTEMA, DEFAULT_MISSIONS } from './domain/gamification';
import { saveQuizEvent, importQuestions, loadSeason, closeSeason, loadProfile, createProfile } from './services/quizService';
const ADMIN_UID = 'ktCddjGUigN8Spm6x9wrdFgzBZy2';

export default function App() {
  const operationLock = useRef(false);
  const sessionId = useRef('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('home');

  // Filtro interno da aba de Missões ('Todas', 'Diária', 'Semanal', 'Mensal')
  const [filtroMissao, setFiltroMissao] = useState('Todas');

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
  const [nomeNovaTemporada, setNomeNovaTemporada] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await carregarDadosUsuario(currentUser.uid);
          await Promise.all([carregarPerguntas(), carregarRanking()]);
        } catch (err) { setError('Não foi possível carregar seu perfil. Verifique sua conexão e entre novamente.'); console.error(err); }
      } else {
        setUserData(null);
        setDisciplinaSelecionada(null);
        setAbaAtiva('home');
        setPerguntas([]);
        setRankingAlunos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timer;
    if (disciplinaSelecionada && perguntasSessao.length > 0 && !saving && !saveError && !respostaConfirmada && !quizFinalizado && tempoRestante > 0) {
      timer = setInterval(() => {
        setTempoRestante((prev) => prev - 1);
      }, 1000);
    } else if (tempoRestante === 0 && perguntasSessao.length > 0 && !saving && !saveError && !respostaConfirmada && disciplinaSelecionada && !quizFinalizado) {
      handleConfirmarResposta();
    }
    return () => clearInterval(timer);
  }, [disciplinaSelecionada, respostaConfirmada, quizFinalizado, tempoRestante, perguntasSessao.length, saving, saveError]);

  const carregarDadosUsuario = async (uid) => {
    const data = await loadProfile(uid);
    if (auth.currentUser?.uid === uid) { setUserData(data); setProfileMissing(data === null); }
    return data;
  };

  const carregarPerguntas = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'));
      const lista = [];
      querySnapshot.forEach((doc) => {
        try { lista.push({ ...normalizeQuestion(doc.data()), id: doc.id }); }
        catch (error) { console.warn(`Questão ${doc.id} ignorada: ${error.message}`); }
      });
      setPerguntas(lista);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const carregarRanking = async () => {
    try {
      const q = query(collection(db, 'rankings'), orderBy('xpTemporada', 'desc'), limit(10));
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
    if (user?.uid !== ADMIN_UID) return;
    setLoading(true);
    try {
      const { default: questions } = await import('./data/questions.json');
      const result = await importQuestions(questions);
      alert(`${result.imported} questões importadas; ${result.duplicates} já existentes.`);
      await carregarPerguntas();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (![nome, curso, turma, unidade].every(v => v.trim() && v.trim().length <= 200)) {
      setError('Preencha os dados do cadastro, com até 200 caracteres por campo.'); return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;
      const currentSeason = await loadSeason();
      const newUserData = {
        uid: newUser.uid, nome: nome.trim(), email: newUser.email,
        curso: curso.trim(), turma: turma.trim(), unidade: unidade.trim(),
        isAdmin: newUser.uid === ADMIN_UID,
        ...initialProgress(currentSeason.name)
      };

      const savedProfile = await createProfile(newUser.uid, newUserData);
      setUserData(savedProfile);
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

    if (user.uid !== ADMIN_UID) {
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

  const handleImportarJSON = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || user?.uid !== ADMIN_UID) return;
    setLoading(true);
    try {
      const result = await importQuestions(JSON.parse(await file.text()));
      alert(`${result.imported} questões importadas; ${result.duplicates} duplicadas ignoradas.`);
      await carregarPerguntas();
    } catch (err) { alert(`Importação não concluída: ${err.message}`); }
    finally { setLoading(false); input.value = ''; }
  };

  const handleCadastrarPergunta = async (e) => {
    e.preventDefault();
    if (user?.uid !== ADMIN_UID) return;
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
        altA,
        altB,
        altC,
        altD,
        altE
      ],
      respostaCorreta: Number(respostaCorretaIndex),
      explicacao: novaExplicacao
    };

    try {
      const result = await importQuestions([novaQ]);
      if (!result.imported) { alert('Esta questão já está no banco.'); return; }
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
    if (user?.uid !== ADMIN_UID) return;
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
    if (user?.uid !== ADMIN_UID) return;
    if (!nomeNovaTemporada.trim()) { alert('Informe o nome da nova temporada.'); return; }
    if (!window.confirm(`Iniciar ${nomeNovaTemporada.trim()}? O XP da temporada será zerado. Conquistas permanentes e missões do calendário serão preservadas.`)) return;
    setLoading(true);
    try {
      await closeSeason(nomeNovaTemporada.trim());
      await carregarDadosUsuario(user.uid);
      await carregarRanking();
      alert('Nova temporada iniciada!');
    } catch (err) { alert(`Não foi possível encerrar a temporada: ${err.message}`); }
    finally { setLoading(false); }
  };

  const prepararBlocoQuestoes = (source, count = 10) => prepareQuestions(source, resetPeriods(userData, DEFAULT_MISSIONS), count);

  const iniciarQuizPorDisciplina = (disc) => {
    const filtradas = perguntas.filter(
      (q) => disc === 'Todas' || q.disciplina === disc
    );

    const blocoPronto = prepararBlocoQuestoes(filtradas, 10);

    sessionId.current = crypto.randomUUID();
    setSaveError('');
    setXpUltimaQuestao(0);
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
    sessionId.current = crypto.randomUUID();
    setAcertosSessao(0);
    setPontosSessao(0);
    setXpUltimaQuestao(0);
    setSaveError('');
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

  const showAwards = (result) => {
    if (result.awardXp) alert(`🎉 ${result.achievements.length} conquista(s) e ${result.missions.length} missão(ões)! +${result.awardXp} XP`);
  };

  const handleConfirmarResposta = async () => {
    if (operationLock.current || respostaConfirmada || !perguntaAtual || !user) return;
    operationLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const result = await saveQuizEvent(user.uid, {
        id: `${sessionId.current}:answer:${indicePerguntaAtual}`, type: 'answer',
        question: perguntaAtual, selected: opcaoSelecionada, remaining: tempoRestante,
        review: isModoRefazer, streak
      });
      setUserData(result.data);
      setRespostaConfirmada(true);
      setMensagemBonus(result.bonus);
      setXpUltimaQuestao(result.xp + result.awardXp);
      setPontosSessao(prev => prev + result.xp + result.awardXp);
      setStreak(result.streak);
      if (result.correct) setAcertosSessao(prev => prev + 1);
      else setPerguntasErradasSessao(prev => [...prev, perguntaAtual]);
      showAwards(result);
    } catch (err) {
      setSaveError('Não foi possível salvar a resposta. Verifique sua conexão e tente novamente.');
      console.error(err);
    } finally { operationLock.current = false; setSaving(false); }
  };

  const handleProximaPergunta = async () => {
    if (operationLock.current || !respostaConfirmada) return;
    if (indicePerguntaAtual + 1 < perguntasSessao.length) {
      setIndicePerguntaAtual(prev => prev + 1);
      setOpcaoSelecionada(null);
      setRespostaConfirmada(false);
      setTempoRestante(TEMPO_LIMITE);
      setMensagemBonus('');
      setXpUltimaQuestao(0);
      setSaveError('');
      return;
    }
    operationLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const result = await saveQuizEvent(user.uid, {
        id: `${sessionId.current}:finish`, type: 'finish', correctCount: acertosSessao,
        total: perguntasSessao.length, review: isModoRefazer
      });
      setUserData(result.data);
      setPontosSessao(prev => prev + result.xp + result.awardXp);
      setQuizFinalizado(true);
      showAwards(result);
      await carregarRanking();
    } catch (err) {
      setSaveError('Não foi possível finalizar. Tente novamente; sua pontuação não será duplicada.');
      console.error(err);
    } finally { operationLock.current = false; setSaving(false); }
  };

  if (user && !userData) {
    return <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4 p-6">
      <p role="status">{error || (profileMissing ? 'Complete seu perfil para começar.' : 'Carregando seu perfil...')}</p>
      {profileMissing && <form className="w-full max-w-md space-y-3" onSubmit={async e => {
        e.preventDefault();
        if (loading) return;
        if (![nome, curso, turma, unidade].every(v => v.trim())) { setError('Preencha todos os campos.'); return; }
        setLoading(true); setError('');
        try {
          const currentSeason = await loadSeason();
          const profile = await createProfile(user.uid, {
            uid: user.uid, email: user.email, nome: nome.trim(), curso: curso.trim(),
            turma: turma.trim(), unidade: unidade.trim(), isAdmin: user.uid === ADMIN_UID,
            ...initialProgress(currentSeason.name)
          });
          setUserData(profile); setProfileMissing(false);
          await Promise.all([carregarPerguntas(), carregarRanking()]);
        } catch { setError('Não foi possível concluir o cadastro. Verifique a conexão e tente novamente.'); }
        finally { setLoading(false); }
      }}>
        {[["Nome completo", nome, setNome], ["Curso", curso, setCurso], ["Turma", turma, setTurma], ["Unidade", unidade, setUnidade]].map(([label, value, change]) =>
          <label key={label} className="block">{label}<input required maxLength={200} value={value} onChange={e => change(e.target.value)} className="block w-full bg-slate-800 rounded p-2" /></label>
        )}
        <button disabled={loading} className="bg-indigo-600 rounded-lg px-4 py-2">{loading ? 'Salvando...' : 'Concluir cadastro'}</button>
      </form>}
      <button disabled={loading} className="bg-slate-700 rounded-lg px-4 py-2" onClick={async () => {
        setError('');
        try { await carregarDadosUsuario(user.uid); }
        catch { setError('Não foi possível carregar seu perfil. Tente novamente.'); }
      }}>Tentar novamente</button>
      <button disabled={loading} onClick={() => signOut(auth)}>Sair</button>
    </div>;
  }

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
              {!isModoRefazer && perguntasSessao.length === 10 ? 'Você ganhou +30 XP bônus por finalizar o quiz!' : 'Sessão de estudo concluída!'}
            </p>
            
            <div className="bg-slate-700/50 p-4 rounded-xl mb-6 border border-slate-600">
              <span className="text-xs text-slate-400 block mb-1">XP Total Ganho nesta Sessão</span>
              <span className="text-3xl font-black text-emerald-400">+{pontosSessao} XP</span>
              <span className="text-xs text-slate-400 block mt-2">Acertos: {acertosSessao} de {perguntasSessao.length}</span>
            </div>

            {perguntasErradasSessao.length > 0 && (
              <button 
                onClick={refazerQuestoesErradas}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-3 rounded-lg transition mb-3"
              >
                🔄 Refazer Erradas ({perguntasErradasSessao.length})
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
              disabled={saving}
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
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-bold">
              Dificuldade: {perguntaAtual.dificuldade} ({perguntaAtual.dificuldade === 'Fácil' ? '15 XP' : perguntaAtual.dificuldade === 'Difícil' ? '50 XP' : '30 XP'})
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
                  disabled={respostaConfirmada || saving || tempoRestante === 0}
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

          {saveError && <p role="alert" className="mb-3 text-sm text-red-300">{saveError}</p>}
          {!respostaConfirmada ? (
            <button
              onClick={handleConfirmarResposta}
              disabled={saving || (opcaoSelecionada === null && tempoRestante > 0)}
              className="w-full bg-indigo-600 disabled:opacity-50 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition"
            >
              Responder
            </button>
          ) : (
            <button
              disabled={saving}
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
    const isUserAdminAutorizado = userData.isAdmin && user.uid === ADMIN_UID;
    const conquistasDesbloqueadas = userData.conquistasDesbloqueadas || [];
    const missoesConcluidas = userData.missoesConcluidas || [];

    const missoesExibidas = DEFAULT_MISSIONS.filter(m => filtroMissao === 'Todas' || m.tipo === filtroMissao);

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
        <div className="w-full max-w-xl bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 my-4">
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-indigo-400">Olá, {userData.nome}!</h2>
              <p className="text-xs text-slate-400">{userData.email}</p>
              <span className="inline-block mt-1 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                🗓️ Temporada: {userData.temporadaAtual || getPeriods().seasonName}
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
                  <span className="text-xs text-slate-400 block">XP da Temporada ({userData.temporadaAtual || 'Temporada'})</span>
                  <span className="text-2xl font-black text-emerald-400">{userData.xpTemporada || 0} XP</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Vitalício: {userData.pontuacaoGeral || 0} XP</span>
                </div>
                {perguntas.length === 0 && isUserAdminAutorizado && (
                  <button 
                    onClick={handleSeed}
                    className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-2 rounded-lg"
                  >
                    + Carregar Perguntas
                  </button>
                )}
                {!userData.isAdmin && user.uid === ADMIN_UID && (
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
            <div className="space-y-4">
              {/* Filtro de Abas de Missões */}
              <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                {['Todas', 'Diária', 'Semanal', 'Mensal'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setFiltroMissao(tipo)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      filtroMissao === tipo 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tipo === 'Todas' ? '🌐 Todas' : tipo === 'Diária' ? '🟢 Diárias' : tipo === 'Semanal' ? '🔵 Semanais' : '🔴 Mensais'}
                  </button>
                ))}
              </div>

              {/* Lista de Missões Filtradas */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {missoesExibidas.map((missao) => {
                  const concluida = missoesConcluidas.includes(missao.id);
                  const valorProgresso = Math.min(missao.progresso(userData), missao.alvo);
                  const pct = Math.round((valorProgresso / missao.alvo) * 100);

                  return (
                    <div 
                      key={missao.id} 
                      className={`p-3.5 rounded-xl border transition ${
                        concluida 
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-300' 
                          : 'bg-slate-900 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                              missao.tipo === 'Diária' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : missao.tipo === 'Semanal' 
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {missao.tipo}
                            </span>
                            <span className={`text-sm font-bold ${concluida ? 'text-emerald-400 line-through' : 'text-slate-100'}`}>
                              {concluida ? '☑' : '☐'} {missao.nome}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-snug">{missao.desc}</p>
                        </div>
                        <span className="font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 text-xs shrink-0">
                          +{missao.xp} XP
                        </span>
                      </div>

                      {!concluida && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                            <span>Progresso</span>
                            <span className="font-semibold text-slate-300">{valorProgresso} / {missao.alvo} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                            <div 
                              className="bg-indigo-500 h-full transition-all duration-500 rounded-full" 
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {abaAtiva === 'ranking' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  🏆 Top Alunos - {userData.temporadaAtual || 'Temporada Atual'}
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  Ordenado por XP da Temporada
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
                  <h4 className="text-xs font-bold text-slate-200">🏆 Conquistas Permanentes & Secretas ({conquistasDesbloqueadas.length}/{CONQUISTAS_SISTEMA.length})</h4>
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
                  Ao encerrar a temporada, somente o XP do ranking é zerado. Conquistas permanentes, estatísticas e missões diárias, semanais e mensais são preservadas.
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