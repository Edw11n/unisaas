/**
 * Formatea un número o string a Pesos Colombianos (COP) estándar
 * Ejemplo: 1250000 -> "$ 1.250.000"
 */
export function formatCOP(amount: number | string, includeDecimals = false): string {
  const num = Number(amount) || 0;
  const fixed = includeDecimals ? num.toFixed(2) : Math.round(num).toFixed(0);
  const parts = fixed.split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (includeDecimals && parts.length > 1) {
    return `$ ${integerPart},${parts[1]}`;
  }
  return `$ ${integerPart}`;
}

export interface DenominationItem {
  value: number;
  label: string;
  type: 'BILLETE' | 'MONEDA';
}

export const COLOMBIAN_DENOMINATIONS: DenominationItem[] = [
  { value: 100000, label: '$ 100.000', type: 'BILLETE' },
  { value: 50000, label: '$ 50.000', type: 'BILLETE' },
  { value: 20000, label: '$ 20.000', type: 'BILLETE' },
  { value: 10000, label: '$ 10.000', type: 'BILLETE' },
  { value: 5000, label: '$ 5.000', type: 'BILLETE' },
  { value: 2000, label: '$ 2.000', type: 'BILLETE' },
  { value: 1000, label: '$ 1.000', type: 'MONEDA' },
  { value: 500, label: '$ 500', type: 'MONEDA' },
  { value: 200, label: '$ 200', type: 'MONEDA' },
  { value: 100, label: '$ 100', type: 'MONEDA' },
  { value: 50, label: '$ 50', type: 'MONEDA' },
];

export function calculateCashTotal(counts: Record<number, number>): number {
  return Object.entries(counts).reduce((sum, [denomStr, qty]) => {
    const denom = Number(denomStr);
    const count = Number(qty) || 0;
    if (isNaN(denom) || count <= 0) return sum;
    return sum + denom * count;
  }, 0);
}

