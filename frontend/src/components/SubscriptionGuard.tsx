import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Navigate, useLocation } from 'react-router-dom';

interface SubscriptionInfo {
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'unpaid' | 'lifetime';
  trialEndsAt: string;
  gracePeriodEndsAt?: string;
}

interface SubscriptionContextType {
  info: SubscriptionInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isBlocked: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const location = useLocation();

  const fetchInfo = async () => {
    if (!user || user.role === 'super_admin') {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/billing/info');
      setInfo(response.data);
      
      const status = response.data.subscriptionStatus;
      const trialEndsAt = new Date(response.data.trialEndsAt);
      const graceEndsAt = response.data.gracePeriodEndsAt ? new Date(response.data.gracePeriodEndsAt) : null;
      const now = new Date();

      if (status === 'unpaid') {
        setIsBlocked(true);
      } else if (status === 'trial' && now > trialEndsAt) {
        setIsBlocked(true);
      } else if (status === 'past_due' && graceEndsAt && now > graceEndsAt) {
        setIsBlocked(true);
      } else {
        setIsBlocked(false);
      }
    } catch (error: any) {
      if (error.response?.status === 402) {
        setIsBlocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, [user]);

  // Handle 402 globally
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 402) {
          setIsBlocked(true);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <SubscriptionContext.Provider value={{ info, loading, refresh: fetchInfo, isBlocked }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isBlocked, loading } = useSubscription();
  const { user } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // Allow billing page even if blocked
  if (isBlocked && location.pathname !== '/dashboard/billing' && user?.role !== 'super_admin') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-2xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Bloqueado</h2>
          <p className="text-slate-600 mb-8">
            Sua assinatura expirou ou o pagamento está pendente. Por favor, regularize sua situação para continuar utilizando a plataforma.
          </p>
          <a
            href="/dashboard/billing"
            className="inline-block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
          >
            Gerenciar Assinatura
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
