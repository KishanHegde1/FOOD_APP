import { Injectable } from '@nestjs/common';
import { Food } from '../foods/entities/food.entity';

export type DineInFoodAvailability = {
  currentlyAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  message: string | null;
};

/** Applies an item's daily service window in the restaurant's operating timezone. */
@Injectable()
export class DineInMenuAvailabilityService {
  private readonly timeZone =
    process.env.DINE_IN_MENU_TIMEZONE ?? 'Asia/Kolkata';

  getAvailability(food: Food, now = new Date()): DineInFoodAvailability {
    const startTime = food.availableFromTime;
    const endTime = food.availableUntilTime;
    const manuallyAvailable = food.isActive && food.isAvailable;

    if (!startTime || !endTime) {
      return {
        currentlyAvailable: manuallyAvailable,
        startTime: null,
        endTime: null,
        message: manuallyAvailable ? null : 'Currently unavailable',
      };
    }

    const currentMinutes = this.localMinutes(now);
    const startMinutes = this.toMinutes(startTime);
    const endMinutes = this.toMinutes(endTime);
    const isInWindow =
      startMinutes < endMinutes
        ? currentMinutes >= startMinutes && currentMinutes < endMinutes
        : currentMinutes >= startMinutes || currentMinutes < endMinutes;
    const currentlyAvailable = manuallyAvailable && isInWindow;

    return {
      currentlyAvailable,
      startTime: this.toDisplayTime(startTime),
      endTime: this.toDisplayTime(endTime),
      message: currentlyAvailable
        ? null
        : manuallyAvailable
          ? `Available daily from ${this.toDisplayTime(startTime)} to ${this.toDisplayTime(endTime)}`
          : 'Currently unavailable',
    };
  }

  isAvailableNow(food: Food, now = new Date()): boolean {
    return this.getAvailability(food, now).currentlyAvailable;
  }

  private localMinutes(now: Date): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    return hour * 60 + minute;
  }

  private toMinutes(time: string): number {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }

  private toDisplayTime(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }
}
