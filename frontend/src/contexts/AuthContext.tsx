import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    mfaRequired: false,
    mfaVerified: false,
  });

  const checkSession = async () => {
    try {
      const response = await api.get('/auth/session');
      setState({
        isAuthenticated: response.data.authenticated,
        isLoading: false,
        mfaRequired: response.data.authenticated && !response.data.mfaVerified,
        mfaVerified: response.data.mfaVerified ?? false,
      });
    } catch {
      setState({
        isAuthenticated: false,
        isLoading: false,
        mfaRequired: false,
        mfaVerified: false,
      });
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    
    if (response.data.mfaRequired) {
      setState(prev => ({ ...prev, mfaRequired: true }));
      navigate('/mfa');
    } else {
      await checkSession();
      navigate('/dashboard');
    }
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setState({
      isAuthenticated: false,
      isLoading: false,
      mfaRequired: false,
      mfaVerified: false,
    });
    navigate('/login');
  };

  const verifyMfa = async (code: string) => {
    await api.post('/auth/mfa/verify', { code });
    await checkSession();
    navigate('/dashboard');
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, verifyMfa, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
