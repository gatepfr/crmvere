export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 lg:p-12">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: 19 de abril de 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">1. Identificação do Responsável</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Esta Política de Privacidade é aplicável ao sistema <strong>CRM Vere</strong>, disponível em{' '}
            <strong>crmvere.com.br</strong>, operado por:
          </p>
          <ul className="mt-3 text-sm text-slate-600 space-y-1 ml-4">
            <li><strong>Responsável:</strong> Paulo Fabrício Magri dos Reis</li>
            <li><strong>CPF/CNPJ:</strong> 66.301.043/0001-15</li>
            <li><strong>Localização:</strong> Apucarana – PR, Brasil</li>
            <li><strong>E-mail:</strong> mktpoliticoapuca@gmail.com</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">2. O que é o CRM Vere</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            O CRM Vere é um sistema de gestão de gabinete para vereadores, que permite gerenciar demandas de munícipes,
            agenda de compromissos, campanhas eleitorais e comunicação via WhatsApp. O acesso ao sistema é restrito a
            usuários autorizados (gabinetes cadastrados).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">3. Dados Coletados</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">Coletamos os seguintes dados:</p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li><strong>Dados de cadastro:</strong> nome, e-mail e senha dos usuários do sistema.</li>
            <li><strong>Dados dos munícipes:</strong> nome, telefone, endereço e demandas registradas pelos gabinetes.</li>
            <li><strong>Dados do Google Calendar:</strong> quando o usuário conecta voluntariamente sua conta Google, coletamos um token de autorização (refresh token) para acessar e gerenciar eventos da agenda. Não acessamos e-mails, contatos ou outros dados da conta Google além dos eventos do calendário.</li>
            <li><strong>Dados de uso:</strong> registros de acesso e utilização do sistema para fins de suporte técnico.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">4. Uso dos Dados do Google Calendar</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">
            A integração com o Google Calendar é <strong>opcional e iniciada pelo próprio usuário</strong>. Ao conectar
            sua conta Google, o CRM Vere poderá:
          </p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li>Ler os eventos da agenda do usuário para exibição no painel;</li>
            <li>Criar novos eventos na agenda em nome do usuário;</li>
            <li>Editar ou excluir eventos criados pelo próprio sistema.</li>
          </ul>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            Os dados do Google Calendar <strong>não são compartilhados com terceiros</strong> e são utilizados
            exclusivamente para a funcionalidade de agenda dentro do sistema. O usuário pode desconectar sua conta
            Google a qualquer momento nas configurações do gabinete.
          </p>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            O uso de dados obtidos por meio das APIs do Google está em conformidade com a{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Política de Dados de Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de uso limitado.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">5. Compartilhamento de Dados</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros, exceto quando necessário para
            operação do serviço (ex.: provedores de infraestrutura de nuvem) ou quando exigido por lei. Todos os
            provedores são contratualmente obrigados a manter a confidencialidade dos dados.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">6. Armazenamento e Segurança</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Os dados são armazenados em servidores seguros com acesso restrito. Utilizamos criptografia para
            transmissão de dados (HTTPS) e tokens de autenticação protegidos. Tokens do Google Calendar são
            armazenados de forma segura no banco de dados e nunca expostos publicamente.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">7. Direitos do Usuário (LGPD)</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
          </p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li>Confirmar a existência de tratamento dos seus dados;</li>
            <li>Acessar seus dados;</li>
            <li>Corrigir dados incompletos ou desatualizados;</li>
            <li>Solicitar a exclusão dos seus dados;</li>
            <li>Revogar o consentimento a qualquer momento;</li>
            <li>Desconectar a integração com o Google Calendar nas configurações do sistema.</li>
          </ul>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            Para exercer esses direitos, entre em contato pelo e-mail:{' '}
            <a href="mailto:mktpoliticoapuca@gmail.com" className="text-blue-600 hover:underline">
              mktpoliticoapuca@gmail.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">8. Retenção de Dados</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Os dados são mantidos enquanto a conta do gabinete estiver ativa. Após o cancelamento, os dados são
            removidos em até 30 dias, salvo obrigação legal de retenção.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">9. Cookies</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            O sistema utiliza apenas cookies essenciais para manter a sessão autenticada do usuário. Não utilizamos
            cookies de rastreamento ou publicidade.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">10. Alterações nesta Política</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas aos usuários
            por e-mail ou por aviso dentro do sistema. O uso continuado do sistema após as alterações implica
            aceitação da nova política.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">11. Contato</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Para dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados:
          </p>
          <ul className="mt-3 text-sm text-slate-600 space-y-1 ml-4">
            <li><strong>E-mail:</strong> mktpoliticoapuca@gmail.com</li>
            <li><strong>Responsável:</strong> Paulo Fabrício Magri dos Reis</li>
            <li><strong>CNPJ:</strong> 66.301.043/0001-15</li>
            <li><strong>Apucarana – PR, Brasil</strong></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
