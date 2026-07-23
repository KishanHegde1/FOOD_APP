import { InternalServerErrorException } from '@nestjs/common';

/**
 * Money is persisted as PostgreSQL NUMERIC(12,2). TypeORM may return NUMERIC
 * as a string, so all booking calculations use integer paise (bigint) and are
 * converted back to a fixed two-decimal string only for storage/response.
 */
export function numericToPaise(value: string | number): bigint {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new InternalServerErrorException(
      'Invalid money value in booking data.',
    );
  }

  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -paise : paise;
}

export function paiseToNumeric(paise: bigint): string {
  const negative = paise < 0n;
  const unsigned = negative ? -paise : paise;
  const whole = unsigned / 100n;
  const fraction = (unsigned % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

export function paiseToNumber(paise: bigint): number {
  return Number(paiseToNumeric(paise));
}

export function taxFromPercentage(
  subtotalPaise: bigint,
  percentage: string | number,
): bigint {
  const percentageHundredths = numericToPaise(percentage);
  if (percentageHundredths < 0n) {
    throw new InternalServerErrorException(
      'Invalid tax percentage in hotel data.',
    );
  }

  // percentageHundredths represents percentage × 100. Divide by 10,000 to
  // calculate the percentage of subtotal and round half up to the nearest paise.
  return divideAndRoundHalfUp(subtotalPaise * percentageHundredths, 10_000n);
}

export function divideAndRoundHalfUp(value: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error('divisor must be positive');
  if (value < 0n) return -divideAndRoundHalfUp(-value, divisor);
  return (value + divisor / 2n) / divisor;
}
