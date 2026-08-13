import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DineInPaymentListQueryDto } from './dto/dine-in-payment-list-query.dto';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInPayment } from './entities/dine-in-payment.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { DineInPaymentsRepository } from './dine-in-payments.repository';
import { PaymentStatus } from './enums/order.enums';

describe('DineInPaymentsRepository', () => {
  it('groups manager PROCESSING filter across all open online statuses', async () => {
    const andWhere = jest.fn().mockReturnThis();
    const builder = {
      where: jest.fn().mockReturnThis(),
      andWhere,
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as jest.Mocked<SelectQueryBuilder<DineInPayment>>;
    const payments = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as unknown as Repository<DineInPayment>;
    const repository = new DineInPaymentsRepository(
      payments,
      {} as Repository<DineInInvoice>,
      {} as Repository<DineInSession>,
      {} as DataSource,
    );

    await repository.listForRestaurant(
      '40000000-0000-4000-8000-000000000001',
      Object.assign(new DineInPaymentListQueryDto(), {
        status: PaymentStatus.PROCESSING,
      }),
    );

    expect(andWhere).toHaveBeenCalledWith(
      'payment.status IN (:...processingStatuses)',
      {
        processingStatuses: [
          PaymentStatus.CREATED,
          PaymentStatus.PENDING,
          PaymentStatus.PROCESSING,
          PaymentStatus.AUTHORIZED,
        ],
      },
    );
  });

  it('keeps the customer PROCESSING filter exact', async () => {
    const andWhere = jest.fn().mockReturnThis();
    const builder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere,
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as jest.Mocked<SelectQueryBuilder<DineInPayment>>;
    const payments = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as unknown as Repository<DineInPayment>;
    const repository = new DineInPaymentsRepository(
      payments,
      {} as Repository<DineInInvoice>,
      {} as Repository<DineInSession>,
      {} as DataSource,
    );

    await repository.listForCustomer(
      '10000000-0000-4000-8000-000000000001',
      Object.assign(new DineInPaymentListQueryDto(), {
        status: PaymentStatus.PROCESSING,
      }),
    );

    expect(andWhere).toHaveBeenCalledWith('payment.status = :status', {
      status: PaymentStatus.PROCESSING,
    });
  });
});
