export type CancellationPolicy = {
  refundable: boolean;
  freeCancellationHours?: number;
};

export type NightlyPriceSnapshot = {
  date: string;
  pricePerRoom: string;
  roomCount: number;
  lineTotal: string;
  availableRooms?: number;
};

export type BookingPricingSnapshot = {
  nightlyBreakdown: NightlyPriceSnapshot[];
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  taxPercentage: string;
};
