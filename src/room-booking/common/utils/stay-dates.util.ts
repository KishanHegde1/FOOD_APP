import { BadRequestException } from '@nestjs/common';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStayDate(value: string, fieldName: string): Date {
  if (!DATE_ONLY.test(value)) {
    throw new BadRequestException(`${fieldName} must be a YYYY-MM-DD date.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatStayDate(date) !== value) {
    throw new BadRequestException(`${fieldName} is not a valid calendar date.`);
  }
  return date;
}

export function assertValidStay(
  checkIn: string,
  checkOut: string,
  options: { requireFutureCheckIn?: boolean } = {},
): { checkIn: Date; checkOut: Date; nights: number } {
  const checkInDate = parseStayDate(checkIn, 'checkIn');
  const checkOutDate = parseStayDate(checkOut, 'checkOut');
  const today = startOfTodayUtc();

  if (options.requireFutureCheckIn !== false && checkInDate < today) {
    throw new BadRequestException('checkIn cannot be before today.');
  }
  if (checkOutDate <= checkInDate) {
    throw new BadRequestException('checkOut must be after checkIn.');
  }

  const nights = Math.round(
    (checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000,
  );
  return { checkIn: checkInDate, checkOut: checkOutDate, nights };
}

export function stayDates(checkIn: Date, numberOfNights: number): string[] {
  return Array.from({ length: numberOfNights }, (_, index) => {
    const date = new Date(checkIn);
    date.setUTCDate(date.getUTCDate() + index);
    return formatStayDate(date);
  });
}

export function formatStayDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
