import React from 'react';
import { useSubscription } from './SubscriptionGuard';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const BillingBanner: React.FC = () => {
  const { info, isBlocked } = useSubscription();
  const { user } = useAuth();

  if (!info || user?.role === 'super_admin' || isBlocked) return null;

  const now = new Date();
  const trialEndsAt = new Date(info.trialEndsAt);
  const graceEndsAt = info.gracePeriodEndsAt ? new Date(info.gracePeriodEndsAt) : null;

  const daysLeft = (date: Date) => {
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (info.subscriptionStatus === 'trial') {
    const left = daysLeft(trialEndsAt);
    if (left <= 3 && left > 0) {
      return (
        <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 text-center text-sm font-medium text-amber-800">
          Seu período de teste termina em {left} {left === 1 ? 'dia' : 'dias'}.{' '}
          <Link to="/dashboard/billing" className="underline font-bold">Assine agora</Link> para não perder o acesso.
        </div>
      );
    }
  }

  if (info.subscriptionStatus === 'past_due') {
    const left = graceEndsAt ? daysLeft(graceEndsAt) : 0;
    return (
      <div className="bg-red-50 border-b border-red-200 py-2 px-4 text-center text-sm font-medium text-red-800">
        Pagamento em atraso. Você tem {left} {left === 1 ? 'dia' : 'dias'} de carência antes do bloqueio.{' '}
        <Link to="/dashboard/billing" className="underline font-bold">Regularizar agora</Link>
      </div>
    );
  }

  return null;
};
