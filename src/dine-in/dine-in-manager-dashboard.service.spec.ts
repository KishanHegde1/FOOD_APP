import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { DineInManagerDashboardService } from './dine-in-manager-dashboard.service';

const RESTAURANT_ID = '20000000-0000-4000-8000-000000000001';
const OWNER_ID = '10000000-0000-4000-8000-000000000001';

describe('DineInManagerDashboardService', () => {
  let service: DineInManagerDashboardService;
  let dataSource: { query: jest.Mock };

  beforeEach(() => {
    dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { active: '2', billRequested: '1', paymentPending: '1' },
        ])
        .mockResolvedValueOnce([
          {
            pendingApproval: '3',
            approved: '1',
            preparing: '2',
            ready: '1',
            served: '8',
            activeTotalPaise: '73400',
          },
        ])
        .mockResolvedValueOnce([
          {
            requestedBills: '1',
            paymentPendingBills: '2',
            amountAwaitingPaymentPaise: '84500',
          },
        ])
        .mockResolvedValueOnce([
          {
            awaitingConfirmationCount: '1',
            awaitingConfirmationAmountPaise: '29900',
          },
        ]),
    };
    const restaurantsService = {
      findOneForManagement: jest.fn().mockResolvedValue({
        id: RESTAURANT_ID,
        ownerId: OWNER_ID,
      }),
    };
    service = new DineInManagerDashboardService(
      dataSource as unknown as DataSource,
      restaurantsService as unknown as RestaurantsService,
    );
  });

  it('returns numeric manager metrics for an owned restaurant', async () => {
    await expect(
      service.getDashboard(owner(), RESTAURANT_ID),
    ).resolves.toMatchObject({
      restaurantId: RESTAURANT_ID,
      sessions: { active: 2, billRequested: 1, paymentPending: 1 },
      orders: { pendingApproval: 3, preparing: 2, activeTotalPaise: 73400 },
      billing: { paymentPendingBills: 2, amountAwaitingPaymentPaise: 84500 },
      cash: {
        awaitingConfirmationCount: 1,
        awaitingConfirmationAmountPaise: 29900,
      },
    });
    expect(dataSource.query).toHaveBeenCalledTimes(4);
  });

  it('does not expose another restaurant dashboard to a different owner', async () => {
    await expect(
      service.getDashboard(owner({ id: 'other-owner' }), RESTAURANT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

function owner(overrides: Partial<User> = {}): User {
  return {
    id: OWNER_ID,
    role: UserRole.RESTAURANT_OWNER,
    isActive: true,
    ...overrides,
  } as User;
}
