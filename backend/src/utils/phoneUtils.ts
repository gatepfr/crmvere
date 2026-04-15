/**
 * Normaliza números de telefone para o padrão brasileiro:
 * - Remove caracteres não numéricos
 * - Adiciona o prefixo 55 se estiver faltando (para números de 10 ou 11 dígitos)
 * - Garante o nono dígito em números brasileiros (opcional, mas recomendado)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  let clean = phone.replace(/\D/g, '');
  
  // Se for um número brasileiro sem prefixo (10 ou 11 dígitos)
  if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  // Correção do 9º dígito para números brasileiros (prefixo 55 + 10 dígitos)
  if (clean.startsWith('55') && clean.length === 12) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    // Adiciona o 9 se não tiver (DDD + 8 dígitos)
    clean = `55${ddd}9${rest}`;
  }
  
  return clean;
}
