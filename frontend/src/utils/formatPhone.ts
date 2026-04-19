export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) cleaned = cleaned.slice(2);
  if (cleaned.length === 10) cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
  if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  return phone;
}
