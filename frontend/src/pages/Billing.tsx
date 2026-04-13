import React, { useState } from 'react';
import { useSubscription } from '../components/SubscriptionGuard';
import api from '../api/client';

const Billing: React.FC = () => {
  const { info, refresh, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/billing/checkout');
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Erro ao iniciar checkout');
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/billing/portal');
      window.location.href = data.url;
    } catch (error) {
      console.error('Portal error:', error);
      alert('Erro ao abrir portal de cobrança');
    } finally {
      setLoading(false);
    }
  };

  if (subLoading) return <div>Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Assinatura e Cobrança
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Gerencie seus planos e faturas do Stripe.
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            info?.subscriptionStatus === 'active' || info?.subscriptionStatus === 'lifetime'
              ? 'bg-green-100 text-green-800'
              : info?.subscriptionStatus === 'trial'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {info?.subscriptionStatus?.toUpperCase() || '---'}
          </span>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Plano Atual</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                Plano Vereador Pro - R$ 247,00 / mês
              </dd>
            </div>
            {info?.subscriptionStatus === 'trial' && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Trial expira em</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(info.trialEndsAt).toLocaleDateString()}
                </dd>
              </div>
            )}
            <div className="py-4 sm:py-5 sm:px-6 flex gap-4">
              {(!info?.stripeSubscriptionId || info.subscriptionStatus === 'trial') ? (
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? 'Processando...' : 'Assinar Agora'}
                </button>
              ) : (
                <button
                  onClick={handlePortal}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {loading ? 'Processando...' : 'Gerenciar no Stripe'}
                </button>
              )}
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default Billing;
