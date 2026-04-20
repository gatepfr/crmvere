export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 lg:p-12">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Termos de Serviço</h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: 20 de abril de 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">1. Aceitação dos Termos</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Ao acessar ou utilizar o <strong>CRM Vere</strong> (disponível em <strong>crmvere.com.br</strong>), você
            concorda com estes Termos de Serviço. Caso não concorde com alguma disposição, não utilize o sistema.
            O uso continuado do serviço após alterações nos Termos implica aceitação das novas condições.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">2. Descrição do Serviço</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            O CRM Vere é uma plataforma de gestão de gabinete destinada a vereadores e suas equipes. O sistema oferece
            funcionalidades para gerenciamento de demandas de munícipes, agenda de compromissos com integração ao
            Google Calendar, acompanhamento de campanhas eleitorais e comunicação via WhatsApp. O acesso é restrito a
            gabinetes e usuários previamente cadastrados e autorizados.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">3. Elegibilidade e Cadastro</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">
            Para utilizar o CRM Vere, o usuário deve:
          </p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li>Ser maior de 18 anos ou ter autorização legal de um responsável;</li>
            <li>Fornecer informações verdadeiras, completas e atualizadas no cadastro;</li>
            <li>Manter a confidencialidade de suas credenciais de acesso (e-mail e senha);</li>
            <li>Ser vinculado a um gabinete de vereador cadastrado na plataforma.</li>
          </ul>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            O usuário é responsável por todas as atividades realizadas com sua conta. Em caso de acesso não
            autorizado, notifique-nos imediatamente pelo e-mail{' '}
            <a href="mailto:mktpoliticoapuca@gmail.com" className="text-blue-600 hover:underline">
              mktpoliticoapuca@gmail.com
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">4. Uso Permitido</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">
            O CRM Vere deve ser utilizado exclusivamente para fins legítimos de gestão de gabinete. É expressamente
            proibido:
          </p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li>Usar o sistema para fins ilícitos, fraudulentos ou contrários à legislação brasileira;</li>
            <li>Compartilhar credenciais de acesso com pessoas não autorizadas;</li>
            <li>Inserir dados falsos, enganosos ou de terceiros sem consentimento;</li>
            <li>Tentar acessar áreas restritas do sistema ou de outros gabinetes;</li>
            <li>Realizar engenharia reversa, descompilar ou copiar o sistema;</li>
            <li>Utilizar o sistema para envio de comunicações não solicitadas (spam).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">5. Integração com Google Calendar</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-3">
            A integração com o Google Calendar é opcional e iniciada exclusivamente pelo usuário. Ao conectar sua
            conta Google, o usuário autoriza o CRM Vere a:
          </p>
          <ul className="text-sm text-slate-600 space-y-2 ml-4 list-disc">
            <li>Acessar e exibir os eventos do calendário no painel do sistema;</li>
            <li>Criar, editar e excluir eventos em nome do usuário.</li>
          </ul>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            O usuário pode revogar essa autorização a qualquer momento nas configurações do gabinete. O uso dos
            dados do Google Calendar está sujeito também à{' '}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Política de Termos do Google
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">6. Planos e Pagamentos</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            O CRM Vere pode oferecer planos pagos com diferentes funcionalidades. Os valores e condições de cada
            plano serão exibidos no momento da contratação. O não pagamento de mensalidades pode resultar na
            suspensão ou cancelamento do acesso. Não há reembolso de períodos já utilizados, exceto quando exigido
            por lei.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">7. Propriedade Intelectual</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Todos os direitos sobre o CRM Vere — incluindo código-fonte, design, logotipos, textos e
            funcionalidades — pertencem exclusivamente a{' '}
            <strong>Paulo Fabrício Magri dos Reis (CNPJ 66.301.043/0001-15)</strong>. É vedada qualquer reprodução,
            distribuição ou criação de obras derivadas sem autorização prévia e por escrito.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">8. Dados dos Munícipes e LGPD</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Os gabinetes são responsáveis pelo tratamento dos dados pessoais dos munícipes inseridos no sistema,
            atuando como <strong>controladores de dados</strong> nos termos da Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018). O CRM Vere atua como <strong>operador</strong>, processando esses dados
            exclusivamente conforme as instruções dos gabinetes e os fins declarados nestes Termos e na{' '}
            <a href="/privacy-policy" className="text-blue-600 hover:underline">
              Política de Privacidade
            </a>
            . Os gabinetes devem garantir que possuem base legal adequada para inserir e tratar tais dados.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">9. Disponibilidade e Suporte</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Envidamos esforços para manter o sistema disponível 24 horas por dia, 7 dias por semana. No entanto,
            não garantimos disponibilidade ininterrupta, podendo ocorrer interrupções para manutenção, atualizações
            ou por motivos de força maior. O suporte é prestado pelo e-mail{' '}
            <a href="mailto:mktpoliticoapuca@gmail.com" className="text-blue-600 hover:underline">
              mktpoliticoapuca@gmail.com
            </a>{' '}
            em dias úteis.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">10. Limitação de Responsabilidade</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            O CRM Vere é fornecido "como está". Não nos responsabilizamos por danos indiretos, lucros cessantes ou
            perda de dados decorrentes do uso ou incapacidade de uso do sistema, desde que não causados por nossa
            negligência. Nossa responsabilidade total fica limitada ao valor pago pelo usuário nos últimos 3 meses.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">11. Suspensão e Encerramento</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Reservamo-nos o direito de suspender ou encerrar o acesso de qualquer usuário que viole estes Termos,
            pratique atos ilícitos ou prejudique o funcionamento do sistema, sem aviso prévio e sem direito a
            reembolso. O usuário pode solicitar o cancelamento de sua conta a qualquer momento pelo e-mail de
            suporte.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">12. Alterações nos Termos</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Podemos atualizar estes Termos a qualquer momento. Alterações relevantes serão comunicadas por e-mail
            ou por aviso dentro do sistema com antecedência mínima de 10 dias. O uso continuado após o prazo
            implica aceitação das novas condições.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-3">13. Lei Aplicável e Foro</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca
            de <strong>Apucarana – PR</strong> para dirimir quaisquer conflitos decorrentes deste instrumento,
            com renúncia a qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">14. Contato</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Para dúvidas ou solicitações relacionadas a estes Termos de Serviço:
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
