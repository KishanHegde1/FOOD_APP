import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FoodQueryDto } from '../foods/dto/food-query.dto';
import { FoodResponseDto } from '../foods/dto/food-response.dto';
import { FoodsRepository } from '../foods/foods.repository';
import { MenuCategoriesRepository } from '../menu-categories/menu-categories.repository';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { DineInMenuQueryDto } from './dto/dine-in-menu-query.dto';
import {
  DineInMenuResponseDto,
  DineInMenuCategoryResponseDto,
} from './dto/dine-in-menu-response.dto';
import { DineInQrScanResponseDto } from './dto/dine-in-qr-scan-response.dto';
import { DineInSessionResponseDto } from './dto/dine-in-session-response.dto';
import { JoinDineInSessionDto } from './dto/join-dine-in-session.dto';
import { RestaurantTableResponseDto } from './dto/restaurant-table-response.dto';
import { StartDineInSessionDto } from './dto/start-dine-in-session.dto';
import {
  TableQrMetadataResponseDto,
  TableQrResponseDto,
} from './dto/table-qr-response.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { ValidateDineInQrDto } from './dto/validate-dine-in-qr.dto';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { DineInQrService } from './dine-in-qr.service';
import { DineInSessionsRepository } from './dine-in-sessions.repository';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import {
  ACTIVE_DINE_IN_SESSION_STATUSES,
  DineInSessionStatus,
} from './enums/dine-in-session-status.enum';
import { RestaurantTablesRepository } from './restaurant-tables.repository';

@Injectable()
export class DineInService {
  constructor(
    private readonly restaurantTablesRepository: RestaurantTablesRepository,
    private readonly sessionsRepository: DineInSessionsRepository,
    private readonly membersRepository: DineInSessionMembersRepository,
    private readonly qrService: DineInQrService,
    private readonly restaurantsService: RestaurantsService,
    private readonly foodsRepository: FoodsRepository,
    private readonly menuCategoriesRepository: MenuCategoriesRepository,
  ) {}

  async scan(
    user: User,
    dto: ValidateDineInQrDto,
  ): Promise<DineInQrScanResponseDto> {
    this.ensureCustomer(user);
    const table = await this.requireTable(dto.tableId);
    const restaurant = await this.verifyQrForTable(table, dto);
    const session = await this.sessionsRepository.findActiveByTable(table.id);
    const membership = session
      ? await this.membersRepository.findActiveMembership(session.id, user.id)
      : null;

    return {
      valid: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurant.logoUrl,
      },
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        displayName: table.displayName,
        capacity: table.capacity,
      },
      activeSession:
        session && membership
          ? DineInSessionResponseDto.fromEntity(session, membership)
          : null,
    };
  }

  async startSession(
    user: User,
    dto: StartDineInSessionDto,
  ): Promise<DineInSessionResponseDto> {
    this.ensureCustomer(user);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.sessionsRepository.transaction((manager) =>
          this.startSessionInTransaction(user, dto, manager),
        );
      } catch (error) {
        if (!this.isUniqueConstraintViolation(error) || attempt === 1) {
          throw error;
        }
      }
    }

    throw new ConflictException('ACTIVE_SESSION_ALREADY_EXISTS');
  }

  async getCurrentSession(
    user: User,
  ): Promise<DineInSessionResponseDto | null> {
    this.ensureCustomer(user);
    const session = await this.sessionsRepository.findCurrentForUser(user.id);
    if (!session) {
      return null;
    }

    const membership = await this.membersRepository.findActiveMembership(
      session.id,
      user.id,
    );
    return membership
      ? DineInSessionResponseDto.fromEntity(session, membership)
      : null;
  }

  async getSession(
    user: User,
    sessionId: string,
  ): Promise<DineInSessionResponseDto> {
    const { session, membership } = await this.requireActiveSessionMember(
      user,
      sessionId,
    );
    return DineInSessionResponseDto.fromEntity(session, membership);
  }

  async joinSession(
    user: User,
    sessionId: string,
    dto: JoinDineInSessionDto,
  ): Promise<DineInSessionResponseDto> {
    this.ensureCustomer(user);

    return this.sessionsRepository.transaction(async (manager) => {
      const lockedUser = await this.requireLockedCustomer(user.id, manager);
      const session = await this.requireSession(sessionId, manager);
      if (session.status !== DineInSessionStatus.ACTIVE) {
        throw new ConflictException('SESSION_NOT_ACTIVE');
      }
      if (
        session.restaurantId !== dto.restaurantId ||
        session.restaurantTableId !== dto.tableId
      ) {
        throw new BadRequestException('TABLE_RESTAURANT_MISMATCH');
      }

      const table = await this.requireLockedTable(dto.tableId, manager);
      await this.verifyQrForTable(table, dto);
      const currentSession = await this.sessionsRepository.findCurrentForUser(
        lockedUser.id,
        manager,
      );
      if (currentSession && currentSession.id !== session.id) {
        throw new ConflictException('USER_ALREADY_IN_ANOTHER_ACTIVE_SESSION');
      }

      const membership = await this.ensureMembership(
        session.id,
        lockedUser.id,
        manager,
      );
      return DineInSessionResponseDto.fromEntity(session, membership);
    });
  }

  async leaveSession(user: User, sessionId: string): Promise<void> {
    this.ensureCustomer(user);

    await this.sessionsRepository.transaction(async (manager) => {
      const lockedUser = await this.requireLockedCustomer(user.id, manager);
      const session = await this.requireSession(sessionId, manager);
      this.ensureSessionIsActive(session);
      const membership = await this.membersRepository.findActiveMembership(
        session.id,
        lockedUser.id,
        manager,
      );
      if (!membership) {
        throw new ForbiddenException('SESSION_ACCESS_DENIED');
      }
      await this.membersRepository.deactivate(membership, manager);
    });
  }

  async getSessionMenu(
    user: User,
    sessionId: string,
    query: DineInMenuQueryDto,
  ): Promise<DineInMenuResponseDto> {
    const { session } = await this.requireActiveSessionMember(user, sessionId);
    const foodQuery = Object.assign(new FoodQueryDto(), query, {
      isAvailable: true,
    });
    const [categories, result] = await Promise.all([
      this.menuCategoriesRepository.findPublicByRestaurantId(
        session.restaurantId,
      ),
      this.foodsRepository.findByRestaurantId(session.restaurantId, foodQuery),
    ]);

    return {
      restaurantId: session.restaurantId,
      categories: categories.map((category): DineInMenuCategoryResponseDto => ({
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
      })),
      items: result.items.map((food) => FoodResponseDto.fromEntity(food)),
      page: foodQuery.page,
      limit: foodQuery.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / foodQuery.limit),
    };
  }

  async listManagedTables(
    user: User,
    restaurantId: string,
  ): Promise<RestaurantTableResponseDto[]> {
    await this.requireManagedRestaurant(user, restaurantId);
    return (
      await this.restaurantTablesRepository.listByRestaurant(restaurantId)
    ).map((table) => RestaurantTableResponseDto.fromEntity(table));
  }

  async createManagedTable(
    user: User,
    restaurantId: string,
    dto: CreateRestaurantTableDto,
  ): Promise<TableQrResponseDto> {
    await this.requireManagedActiveRestaurant(user, restaurantId);
    const tableNumber = dto.tableNumber.trim();
    const existing =
      await this.restaurantTablesRepository.findByRestaurantAndTableNumber(
        restaurantId,
        tableNumber,
      );
    if (existing) {
      throw new ConflictException('TABLE_NUMBER_ALREADY_EXISTS');
    }

    const generated = this.qrService.generateToken();
    const table = this.restaurantTablesRepository.create({
      restaurantId,
      tableNumber,
      displayName: dto.displayName?.trim() || null,
      capacity: dto.capacity,
      qrTokenHash: generated.tokenHash,
      qrTokenVersion: 1,
      isActive: true,
    });
    const saved = await this.saveTable(table);
    return this.toTableQrResponse(saved, generated.rawToken);
  }

  async updateManagedTable(
    user: User,
    restaurantId: string,
    tableId: string,
    dto: UpdateRestaurantTableDto,
  ): Promise<RestaurantTableResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const table = await this.requireManagedTable(restaurantId, tableId);
    if (dto.displayName !== undefined) {
      table.displayName = dto.displayName.trim() || null;
    }
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.isActive !== undefined) table.isActive = dto.isActive;
    return RestaurantTableResponseDto.fromEntity(await this.saveTable(table));
  }

  async regenerateManagedTableQr(
    user: User,
    restaurantId: string,
    tableId: string,
  ): Promise<TableQrResponseDto> {
    await this.requireManagedActiveRestaurant(user, restaurantId);
    const table = await this.requireManagedTable(restaurantId, tableId);
    const generated = this.qrService.generateToken();
    table.qrTokenHash = generated.tokenHash;
    table.qrTokenVersion += 1;
    const saved = await this.saveTable(table);
    return this.toTableQrResponse(saved, generated.rawToken);
  }

  async getManagedTableQrMetadata(
    user: User,
    restaurantId: string,
    tableId: string,
  ): Promise<TableQrMetadataResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const table = await this.requireManagedTable(restaurantId, tableId);
    return {
      table: RestaurantTableResponseDto.fromEntity(table),
      rawTokenAvailable: false,
      message:
        'Raw QR tokens are not recoverable. Regenerate the QR to receive a replacement.',
    };
  }

  private async startSessionInTransaction(
    user: User,
    dto: StartDineInSessionDto,
    manager: EntityManager,
  ): Promise<DineInSessionResponseDto> {
    const lockedUser = await this.requireLockedCustomer(user.id, manager);
    const table = await this.requireLockedTable(dto.tableId, manager);
    await this.verifyQrForTable(table, dto);

    if (dto.guestCount > table.capacity) {
      throw new BadRequestException('guestCount cannot exceed table capacity.');
    }

    const currentForUser = await this.sessionsRepository.findCurrentForUser(
      lockedUser.id,
      manager,
    );
    if (currentForUser && currentForUser.restaurantTableId !== table.id) {
      throw new ConflictException('USER_ALREADY_IN_ANOTHER_ACTIVE_SESSION');
    }

    const activeSession = await this.sessionsRepository.findActiveByTable(
      table.id,
      manager,
    );
    if (activeSession) {
      if (
        activeSession.status !== DineInSessionStatus.ACTIVE &&
        currentForUser?.id !== activeSession.id
      ) {
        throw new ConflictException('SESSION_NOT_ACTIVE');
      }
      const membership = await this.ensureMembership(
        activeSession.id,
        lockedUser.id,
        manager,
      );
      return DineInSessionResponseDto.fromEntity(activeSession, membership);
    }

    const now = new Date();
    const session = this.sessionsRepository.create(
      {
        restaurantId: table.restaurantId,
        restaurantTableId: table.id,
        openedByUserId: lockedUser.id,
        sessionNumber: this.qrService.createSessionNumber(now),
        status: DineInSessionStatus.ACTIVE,
        guestCount: dto.guestCount,
        currentRoundNumber: 0,
        startedAt: now,
        billRequestedAt: null,
        paymentCompletedAt: null,
        completedAt: null,
        cancelledAt: null,
        closedAt: null,
        cancellationReason: null,
      },
      manager,
    );
    const savedSession = await this.sessionsRepository.save(session, manager);
    const membership = await this.membersRepository.save(
      this.membersRepository.createHost(
        savedSession.id,
        lockedUser.id,
        manager,
      ),
      manager,
    );
    return DineInSessionResponseDto.fromEntity(savedSession, membership);
  }

  private async requireActiveSessionMember(
    user: User,
    sessionId: string,
  ): Promise<{ session: DineInSession; membership: DineInSessionMember }> {
    this.ensureCustomer(user);
    const session = await this.requireSession(sessionId);
    this.ensureSessionIsActive(session);
    const membership = await this.membersRepository.findActiveMembership(
      session.id,
      user.id,
    );
    if (!membership) {
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
    }
    return { session, membership };
  }

  private async requireSession(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<DineInSession> {
    const session = await this.sessionsRepository.findById(sessionId, manager);
    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }
    return session;
  }

  private ensureSessionIsActive(session: DineInSession): void {
    if (
      !(
        ACTIVE_DINE_IN_SESSION_STATUSES as readonly DineInSessionStatus[]
      ).includes(session.status)
    ) {
      throw new ConflictException('SESSION_NOT_ACTIVE');
    }
  }

  private async ensureMembership(
    sessionId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<DineInSessionMember> {
    const membership = await this.membersRepository.findMembership(
      sessionId,
      userId,
      manager,
    );
    if (!membership) {
      return this.membersRepository.save(
        this.membersRepository.createGuest(sessionId, userId, manager),
        manager,
      );
    }
    if (!membership.isActive) {
      return this.membersRepository.reactivate(membership, manager);
    }
    return membership;
  }

  private async requireTable(tableId: string): Promise<RestaurantTable> {
    const table = await this.restaurantTablesRepository.findById(tableId);
    if (!table) {
      throw new NotFoundException('TABLE_NOT_FOUND');
    }
    return table;
  }

  private async requireLockedTable(
    tableId: string,
    manager: EntityManager,
  ): Promise<RestaurantTable> {
    const table = await this.restaurantTablesRepository.lockById(
      tableId,
      manager,
    );
    if (!table) {
      throw new NotFoundException('TABLE_NOT_FOUND');
    }
    return table;
  }

  private async verifyQrForTable(
    table: RestaurantTable,
    dto: ValidateDineInQrDto,
  ): Promise<Restaurant> {
    if (table.restaurantId !== dto.restaurantId) {
      throw new BadRequestException('TABLE_RESTAURANT_MISMATCH');
    }
    if (!table.isActive) {
      throw new ConflictException('TABLE_INACTIVE');
    }
    const restaurant = await this.restaurantsService.findOneForManagement(
      dto.restaurantId,
    );
    if (!restaurant.isActive) {
      throw new ConflictException('RESTAURANT_INACTIVE');
    }
    if (table.qrTokenVersion !== dto.version) {
      throw new BadRequestException('QR_VERSION_MISMATCH');
    }
    if (!this.qrService.matchesHash(dto.token, table.qrTokenHash)) {
      throw new BadRequestException('INVALID_QR');
    }
    return restaurant;
  }

  private async requireLockedCustomer(
    userId: string,
    manager: EntityManager,
  ): Promise<User> {
    const user = await this.sessionsRepository.lockUserById(userId, manager);
    if (!user) {
      throw new ForbiddenException('This user account is inactive.');
    }
    this.ensureCustomer(user);
    return user;
  }

  private async requireManagedRestaurant(
    user: User,
    restaurantId: string,
  ): Promise<Restaurant> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    this.ensureRestaurantManager(user, restaurant);
    return restaurant;
  }

  private async requireManagedActiveRestaurant(
    user: User,
    restaurantId: string,
  ): Promise<Restaurant> {
    const restaurant = await this.requireManagedRestaurant(user, restaurantId);
    if (!restaurant.isActive) {
      throw new ConflictException('RESTAURANT_INACTIVE');
    }
    return restaurant;
  }

  private async requireManagedTable(
    restaurantId: string,
    tableId: string,
  ): Promise<RestaurantTable> {
    const table = await this.restaurantTablesRepository.findById(tableId);
    if (!table || table.restaurantId !== restaurantId) {
      throw new NotFoundException('TABLE_NOT_FOUND');
    }
    return table;
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can use dine-in sessions.');
    }
  }

  private ensureRestaurantManager(user: User, restaurant: Restaurant): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (
      user.role !== UserRole.RESTAURANT_OWNER &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('RESTAURANT_ACCESS_DENIED');
    }
    if (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('RESTAURANT_ACCESS_DENIED');
    }
  }

  private async saveTable(table: RestaurantTable): Promise<RestaurantTable> {
    try {
      return await this.restaurantTablesRepository.save(table);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('TABLE_NUMBER_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  private toTableQrResponse(
    table: RestaurantTable,
    rawToken: string,
  ): TableQrResponseDto {
    return {
      table: RestaurantTableResponseDto.fromEntity(table),
      qrToken: rawToken,
      deepLink: this.qrService.createDeepLink(
        table.restaurantId,
        table.id,
        table.qrTokenVersion,
        rawToken,
      ),
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
