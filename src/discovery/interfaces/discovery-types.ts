export interface RestaurantDiscoveryFilters {
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  isPureVeg?: boolean;
  openNow?: boolean;
  minimumRating?: number;
  maximumDeliveryMinutes?: number;
  maximumDeliveryFeePaise?: number;
}

export interface FoodDiscoveryFilters extends RestaurantDiscoveryFilters {
  q?: string;
  restaurantId?: string;
  categoryId?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  minimumPricePaise?: number;
  maximumPricePaise?: number;
}

export interface DiscoveryRestaurantRecord {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  deliveryTimeMinutes: number;
  deliveryFeePaise: number;
  minimumOrderPaise: number;
  isPureVeg: boolean;
  isOpen: boolean;
  distanceKm: number | null;
}

export interface DiscoveryFoodRecord {
  id: string;
  restaurantId: string;
  restaurantName: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricePaise: number;
  originalPricePaise: number | null;
  rating: number;
  reviewCount: number;
  preparationMinutes: number;
  isVeg: boolean;
  isBestseller: boolean;
  isAvailable: boolean;
  restaurantIsOpen: boolean;
  restaurantIsPureVeg: boolean;
}

export interface DiscoverySuggestionRecord {
  type: 'restaurant' | 'food';
  id: string;
  restaurantId?: string;
  label: string;
  subtitle: string;
  priority: number;
}
