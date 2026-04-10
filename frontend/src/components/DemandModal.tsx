import api from '../api/client';
import { useState } from 'react';

interface DemandModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DemandModal({ demand, onClose, onUpdate }: DemandModalProps) {
  const [status, setStatus] = useState(demand.demandas.status);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await api.patch(`/demands/${demand.demandas.id}/status`, { status: newStatus });
      setStatus(newStatus);
      onUpdate();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Falha ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  if (!demand) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Detalhes da Demanda</h3>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Fechar</span>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Munícipe Info */}
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {demand.municipes.name[0]}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">{demand.municipes.name}</p>
                      <p className="text-xs text-gray-500">{demand.municipes.phone}</p>
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                      </svg>
                      <h4 className="text-sm font-semibold text-blue-800">Resumo da Inteligência Artificial</h4>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed italic">
                      "{demand.demandas.resumoIa}"
                    </p>
                  </div>

                  {/* Categoria and Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Categoria</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">{demand.demandas.categoria}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Prioridade</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        demand.demandas.prioridade.toLowerCase() === 'alta' ? 'bg-red-100 text-red-700' :
                        demand.demandas.prioridade.toLowerCase() === 'urgente' ? 'bg-red-200 text-red-900 font-bold' :
                        demand.demandas.prioridade.toLowerCase() === 'media' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {demand.demandas.prioridade}
                      </span>
                    </div>
                  </div>

                  {/* Status Control */}
                  <div className="pt-4 border-t border-gray-100">
                    <label htmlFor="status" className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Alterar Status</label>
                    <div className="flex space-x-2">
                      {['nova', 'em_andamento', 'concluida'].map((s) => (
                        <button
                          key={s}
                          disabled={loading}
                          onClick={() => handleStatusChange(s)}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                            status === s
                              ? 'bg-blue-600 text-white shadow-inner'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          } disabled:opacity-50`}
                        >
                          {s.replace('_', ' ').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
