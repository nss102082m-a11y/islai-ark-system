import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string, rolePassword?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          console.log('🔄 [AuthContext] ユーザーデータ取得中...', user.email);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('✅ [AuthContext] Firestoreからユーザーデータ取得成功');
            console.log('📦 [AuthContext] permissions:', userData.permissions);
            console.log('🔑 [AuthContext] bulkUpload:', userData.permissions?.bulkUpload);
            setCurrentUser(userData);
          } else {
            console.warn('⚠️ [AuthContext] ユーザードキュメントが存在しません');
          }
        } catch (error) {
          console.error('❌ [AuthContext] Error fetching user data:', error);
        }
      } else {
        setCurrentUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string, rolePassword?: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

    if (userDoc.exists()) {
      const userData = userDoc.data() as User;

      if ((userData.role === 'owner_executive' || userData.role === 'admin') && rolePassword) {
        const expectedPassword = userData.role === 'owner_executive' ? '0527' : '0118';
        if (rolePassword !== expectedPassword) {
          await firebaseSignOut(auth);
          throw new Error('役職パスワードが正しくありません');
        }
      }

      setCurrentUser(userData);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const value = {
    currentUser,
    firebaseUser,
    loading,
    signIn,
    signOut,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
