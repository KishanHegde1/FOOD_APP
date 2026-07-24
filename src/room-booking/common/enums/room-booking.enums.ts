export enum HotelType {
  HOTEL = 'HOTEL',
  RESORT = 'RESORT',
  VILLA = 'VILLA',
  APARTMENT = 'APARTMENT',
  HOSTEL = 'HOSTEL',
  GUEST_HOUSE = 'GUEST_HOUSE',
  HOMESTAY = 'HOMESTAY',
}

export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUPER_DELUXE = 'SUPER_DELUXE',
  SUITE = 'SUITE',
  FAMILY = 'FAMILY',
  DORMITORY = 'DORMITORY',
  VILLA = 'VILLA',
  APARTMENT = 'APARTMENT',
}

export enum BedType {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  QUEEN = 'QUEEN',
  KING = 'KING',
  TWIN = 'TWIN',
  BUNK = 'BUNK',
  SOFA_BED = 'SOFA_BED',
}

export enum HotelBookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export enum HotelPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  PAY_AT_HOTEL = 'PAY_AT_HOTEL',
}

export enum HotelPaymentMethod {
  /**
   * Online hotel payment handled by Razorpay. The gateway owns the UPI/card
   * selection; this value intentionally records the gateway rather than a
   * client-asserted payment instrument.
   */
  RAZORPAY = 'RAZORPAY',
  ONLINE = 'ONLINE',
  UPI = 'UPI',
  CARD = 'CARD',
  NET_BANKING = 'NET_BANKING',
  WALLET = 'WALLET',
  PAY_AT_HOTEL = 'PAY_AT_HOTEL',
}

export enum HotelSortBy {
  RECOMMENDED = 'RECOMMENDED',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  RATING = 'RATING',
  POPULARITY = 'POPULARITY',
}
