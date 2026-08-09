import { Food } from '../foods/entities/food.entity';
import { DineInMenuAvailabilityService } from './dine-in-menu-availability.service';

describe('DineInMenuAvailabilityService', () => {
  const service = new DineInMenuAvailabilityService();

  it('makes a lunch-only item available only inside its configured window', () => {
    const food = item({
      availableFromTime: '12:00',
      availableUntilTime: '15:00',
    });

    expect(
      service.getAvailability(food, new Date('2026-08-09T07:00:00.000Z')),
    ).toMatchObject({
      currentlyAvailable: true,
      startTime: '12:00 PM',
      endTime: '3:00 PM',
      message: null,
    });
    expect(
      service.getAvailability(food, new Date('2026-08-09T11:00:00.000Z')),
    ).toMatchObject({
      currentlyAvailable: false,
      message: 'Available daily from 12:00 PM to 3:00 PM',
    });
  });

  it('supports service windows that run past midnight', () => {
    const food = item({
      availableFromTime: '22:00',
      availableUntilTime: '02:00',
    });

    expect(
      service.isAvailableNow(food, new Date('2026-08-09T18:45:00.000Z')),
    ).toBe(true);
    expect(
      service.isAvailableNow(food, new Date('2026-08-09T09:00:00.000Z')),
    ).toBe(false);
  });

  it('does not make a manually unavailable item orderable', () => {
    expect(service.isAvailableNow(item({ isAvailable: false }))).toBe(false);
  });
});

function item(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-id',
    isActive: true,
    isAvailable: true,
    availableFromTime: null,
    availableUntilTime: null,
    ...overrides,
  } as Food;
}
