import { collection, doc, getDoc, getDocs, query, orderBy, limit, runTransaction, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getPeriods, resetPeriods, newSeasonData } from '../domain/periods';
import { DEFAULT_MISSIONS } from '../domain/gamification';
import { applyQuizEvent } from '../domain/progress';
import { validateImport } from '../domain/questions';

const ADMIN_UID = 'ktCddjGUigN8Spm6x9wrdFgzBZy2';
const assertAdmin = () => {
  if (auth.currentUser?.uid !== ADMIN_UID) throw new Error('Acesso restrito ao administrador.');
};
const seasonRef = () => doc(db, 'settings', 'season');
const publicProfile = (uid, data) => ({ uid, nome: data.nome, xpTemporada: data.xpTemporada || 0, pontuacaoGeral: data.pontuacaoGeral || 0, temporadaAtual: data.temporadaAtual || getPeriods().seasonName });

export async function createProfile(uid, data) {
  return runTransaction(db, async tx => {
    const season = await tx.get(seasonRef());
    const existing = await tx.get(doc(db, 'users', uid));
    if (existing.exists()) return existing.data();
    const profile = { ...data, temporadaAtual: season.data()?.name || getPeriods().seasonName };
    tx.set(doc(db, 'users', uid), profile);
    tx.set(doc(db, 'rankings', uid), publicProfile(uid, profile));
    return profile;
  });
}

export async function loadSeason() {
  try {
    const snapshot = await getDoc(seasonRef());
    if (snapshot.exists()) return snapshot.data();
  } catch (error) {
    // Older deployments may not yet allow the settings collection.
    if (error.code !== 'permission-denied') throw error;
  }
  const users = await getDocs(query(collection(db, 'rankings'), orderBy('xpTemporada', 'desc'), limit(1)));
  return { name: users.docs[0]?.data().temporadaAtual || getPeriods().seasonName, legacy: true };
}

export async function loadProfile(uid) {
  return runTransaction(db, async tx => {
    const season = await tx.get(seasonRef());
    const currentSeason = season.data();
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return null;
    const original = snapshot.data();
    let data = resetPeriods(original, DEFAULT_MISSIONS);
    if (currentSeason?.name && data.temporadaAtual !== currentSeason.name) data = newSeasonData(data, currentSeason.name);
    if (JSON.stringify(original) !== JSON.stringify(data)) tx.update(ref, data);
    tx.set(doc(db, 'rankings', uid), publicProfile(uid, data));
    return data;
  });
}

export async function saveQuizEvent(uid, event) {
  if (auth.currentUser?.uid !== uid) throw new Error('Entre novamente para continuar.');
  return runTransaction(db, async tx => {
    const season = await tx.get(seasonRef());
    const ref = doc(db, 'users', uid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Perfil não encontrado.');
    const original = snapshot.data();
    const data = season.data()?.name && original.temporadaAtual !== season.data().name
      ? newSeasonData(original, season.data().name) : original;
    const result = applyQuizEvent(data, event);
    tx.update(ref, result.data);
    tx.set(doc(db, 'rankings', uid), publicProfile(uid, result.data));
    return result;
  });
}

export async function importQuestions(raw) {
  assertAdmin();
  // Validate the entire file before the first write.
  validateImport(raw);
  const existing = await getDocs(collection(db, 'questions'));
  const { questions, duplicates } = validateImport(raw, existing.docs.map(d => d.data()));
  const entries = await Promise.all(questions.map(async q => {
    const bytes = new TextEncoder().encode(q.pergunta.toLocaleLowerCase('pt-BR'));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    return { q, id: hash };
  }));
  let imported = 0;
  try {
    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db);
      for (const { q, id } of entries.slice(i, i + 400)) batch.set(doc(db, 'questions', id), q);
      await batch.commit();
      imported += entries.slice(i, i + 400).length;
    }
  } catch (error) { throw new Error(`${imported} questões salvas antes da falha. Você pode reenviar o arquivo sem duplicá-las. ${error.message}`); }
  return { imported, duplicates };
}

export async function closeSeason(name) {
  assertAdmin();
  const current = await loadSeason();
  if (name === current.name) throw new Error('Use um nome diferente para a nova temporada.');
  const users = await getDocs(collection(db, 'users'));
  // Atomic update: a failed write must never leave only some students reset.
  if (users.size > 200) throw new Error('Para mais de 200 alunos, o encerramento precisa ser executado pelo servidor.');
  const batch = writeBatch(db);
  batch.set(seasonRef(), { name });
  for (const user of users.docs) {
    const data = newSeasonData(user.data(), name);
    batch.update(user.ref, { xpTemporada: 0, temporadaAtual: name });
    batch.set(doc(db, 'rankings', user.id), publicProfile(user.id, data));
  }
  await batch.commit();
}
