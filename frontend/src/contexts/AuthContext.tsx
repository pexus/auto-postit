import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { clearCsrfToken } from '@/lib/csrf';

interface User {
  id: string;
  email: string;
  name: string | null;
  mfaEnabled: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
  user: User | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  logout: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    mfaRequired: false,
    mfaVerified: false,
    user: null,
  });

  const checkSession = useCallback(async () => {
    try {
      const response = await api.get<{
        authenticated: boolean;
        mfaVerified?: boolean;
        user?: User;
      }>('/auth/session');
      
      setState({
        isAuthenticated: response.data.authenticated,
        isLoading: false,
        mfaRequired: response.data.authenticated && (response.data.user?.mfaEnabled ?? false) && !(response.data.mfaVerified ?? false),
        mfaVerified: response.data.mfaVerified ?? false,
        user: response.data.user ?? null,
      });
    } catch {
      setState({
        isAuthenticated: false,
        isLoading: false,
        mfaRequired: false,
        mfaVerified: false,
        user: null,
      });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string): Promise<{ mfaRequired: boolean }> => {
    const response = await api.post<{ mfaRequired: boolean; user?: User }>('/auth/login', {
      email,
      password,
    });

    if (response.data.mfaRequired) {
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        mfaRequired: true,
        mfaVerified: false,
      }));
      return { mfaRequired: true };
    } else {
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        mfaRequired: false,
        mfaVerified: true,
        user: response.data.user ?? null,
      }));
      return { mfaRequired: false };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearCsrfToken();
      setState({
        isAuthenticated: false,
        isLoading: false,
        mfaRequired: false,
        mfaVerified: false,
        user: null,
      });
      navigate('/login');
    }
  };

  const verifyMfa = async (code: string) => {
    const response = await api.post<{ user: User }>('/auth/mfa/verify', { code });
    setState(prev => ({
      ...prev,
      mfaRequired: false,
      mfaVerified: true,
      user: response.data.user,
    }));
  };

  // Redirect logic based on auth state
  useEffect(() => {
    if (state.isLoading) return;

    const publicPaths = ['/login', '/setup', '/mfa'];
    const isPublicPath = publicPaths.includes(location.pathname);

    if (!state.isAuthenticated && !isPublicPath) {
      navigate('/login');
    } else if (state.isAuthenticated && state.mfaRequired && location.pathname !== '/mfa') {
      navigate('/mfa');
    } else if (state.isAuthenticated && state.mfaVerified && isPublicPath) {
      navigate('/dashboard');
    }
  }, [state.isAuthenticated, state.mfaRequired, state.mfaVerified, state.isLoading, location.pathname, navigate]);

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
