import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAchx6ezpP0gSaJmnf9I2k-eRc_jYl7hBg",
  authDomain: "quiz-administracao.firebaseapp.com",
  projectId: "quiz-administracao",
  storageBucket: "quiz-administracao.firebasestorage.app",
  messagingSenderId: "756934524539",
  appId: "1:756934524539:web:977435a96f18272c102cde"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Exporta a função para disparar o e-mail de redefinição de senha
export { sendPasswordResetEmail };