export interface LineCalcInput {
  quantity: number;
  rate: number;
  discountPct: number;
  taxPct: number;
}

export interface LineCalcResult {
  gross: number;
  discountAmt: number;
  taxableValue: number;
  taxAmt: number;
  lineTotal: number;
}

export interface InvoiceCalcResult {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  amountInWords: string;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function calcLine(
  qty: number,
  rate: number,
  discountPct: number,
  taxPct: number
): LineCalcResult {
  const gross = round2(qty * rate);
  const discountAmt = round2(gross * (discountPct / 100));
  const taxableValue = round2(gross - discountAmt);
  const taxAmt = round2(taxableValue * (taxPct / 100));
  const lineTotal = round2(taxableValue + taxAmt);
  return { gross, discountAmt, taxableValue, taxAmt, lineTotal };
}

export function gstSplit(
  taxAmt: number,
  companyState: string,
  customerState: string
): { cgst: number; sgst: number; igst: number } {
  if (companyState.trim().toLowerCase() === customerState.trim().toLowerCase()) {
    const half = round2(taxAmt / 2);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: round2(taxAmt) };
}

export function calcInvoice(
  lines: LineCalcInput[],
  opts: {
    customerState: string;
    companyState: string;
    shipping: number;
    roundOff: number;
  }
): InvoiceCalcResult {
  const lineResults = lines.map((l) =>
    calcLine(l.quantity, l.rate, l.discountPct, l.taxPct)
  );

  const subtotal = round2(lineResults.reduce((s, l) => s + l.gross, 0));
  const totalDiscount = round2(lineResults.reduce((s, l) => s + l.discountAmt, 0));
  const taxableAmount = round2(lineResults.reduce((s, l) => s + l.taxableValue, 0));
  const totalTax = round2(lineResults.reduce((s, l) => s + l.taxAmt, 0));

  const { cgst, sgst, igst } = gstSplit(totalTax, opts.companyState, opts.customerState);
  const grandTotal = round2(taxableAmount + totalTax + opts.shipping + opts.roundOff);

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    totalTax,
    cgst,
    sgst,
    igst,
    grandTotal,
    amountInWords: amountInWordsINR(grandTotal),
  };
}

export function formatINR(amount: number): string {
  const [intPart, decPart = '00'] = Math.abs(amount).toFixed(2).split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted}.${decPart}`;
}

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
}

function indianNumberWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ').trim();
}

export function amountInWordsINR(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let words = indianNumberWords(rupees) + ' Rupees';
  if (paise > 0) words += ' and ' + twoDigits(paise) + ' Paise';
  words += ' Only';
  if (amount < 0) words = 'Minus ' + words;
  return words;
}

export function getNextInvoiceNumber(latest: string | null, date = new Date()): string {
  const fyStartYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const prefix = `INV-${fyStartYear}-`;
  if (!latest || !latest.startsWith(prefix)) return `${prefix}0001`;
  const num = parseInt(latest.slice(prefix.length), 10);
  return `${prefix}${String(num + 1).padStart(4, '0')}`;
}
