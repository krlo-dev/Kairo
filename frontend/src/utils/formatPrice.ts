export type Currency = 'COP' | 'USD' | 'MXN' | 'ARS' | 'CLP' | 'BRL' | 'PEN';

const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  COP: 'es-CO',
  USD: 'en-US',
  MXN: 'es-MX',
  ARS: 'es-AR',
  CLP: 'es-CL',
  BRL: 'pt-BR',
  PEN: 'es-PE',
};

export function formatPrice(amount: number, currency: Currency = 'COP'): string {
  const locale = LOCALE_BY_CURRENCY[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
