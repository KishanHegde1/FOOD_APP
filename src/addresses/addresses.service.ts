import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '../users/entities/user.entity';
import { AddressesRepository } from './addresses.repository';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Address, AddressLabel } from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}

  async findAll(user: User): Promise<AddressResponseDto[]> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      return (await this.addressesRepository.findActiveByUserId(user.id)).map(
        (address) => AddressResponseDto.fromEntity(address),
      );
    });
  }

  async findOne(user: User, id: string): Promise<AddressResponseDto> {
    const address = await this.findActiveAddressForUser(user, id);
    return AddressResponseDto.fromEntity(address);
  }

  async create(user: User, dto: CreateAddressDto): Promise<AddressResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      this.validateCoordinates(dto);

      const address = await this.addressesRepository.transaction(
        async (manager) => {
          const activeAddressCount =
            await this.addressesRepository.countActiveByUser(user.id, manager);
          const isDefault = dto.isDefault === true || activeAddressCount === 0;
          if (isDefault) {
            await this.addressesRepository.unsetActiveDefaultsForUser(
              user.id,
              manager,
            );
          }

          return this.addressesRepository.save(
            this.addressesRepository.create(
              {
                userId: user.id,
                label: dto.label ?? AddressLabel.HOME,
                recipientName: dto.recipientName.trim(),
                phone: this.normalizePhone(dto.phone),
                addressLine: dto.addressLine.trim(),
                locality: this.optionalText(dto.locality),
                landmark: this.optionalText(dto.landmark),
                city: dto.city.trim(),
                state: this.optionalText(dto.state),
                postalCode: dto.postalCode.trim(),
                country: dto.country?.trim() || 'India',
                latitude: dto.latitude ?? null,
                longitude: dto.longitude ?? null,
                isDefault,
                isActive: true,
              },
              manager,
            ),
            manager,
          );
        },
      );

      return AddressResponseDto.fromEntity(address);
    });
  }

  async update(
    user: User,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      const address = await this.addressesRepository.transaction(
        async (manager) => {
          const current = await this.requireActiveAddress(user, id, manager);
          this.applyUpdates(current, dto);
          this.validateCoordinates(current);

          if (dto.isDefault === true) {
            await this.addressesRepository.unsetActiveDefaultsForUser(
              user.id,
              manager,
            );
            current.isDefault = true;
          }

          return this.addressesRepository.save(current, manager);
        },
      );
      return AddressResponseDto.fromEntity(address);
    });
  }

  async setDefault(user: User, id: string): Promise<AddressResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      const address = await this.addressesRepository.transaction(
        async (manager) => {
          const current = await this.requireActiveAddress(user, id, manager);
          await this.addressesRepository.unsetActiveDefaultsForUser(
            user.id,
            manager,
          );
          current.isDefault = true;
          return this.addressesRepository.save(current, manager);
        },
      );
      return AddressResponseDto.fromEntity(address);
    });
  }

  async remove(user: User, id: string): Promise<void> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      await this.addressesRepository.transaction(async (manager) => {
        const current = await this.requireActiveAddress(user, id, manager);
        const wasDefault = current.isDefault;
        current.isActive = false;
        current.isDefault = false;
        await this.addressesRepository.save(current, manager);

        if (wasDefault) {
          const replacement =
            await this.addressesRepository.findFirstActiveByUserId(
              user.id,
              manager,
            );
          if (replacement) {
            replacement.isDefault = true;
            await this.addressesRepository.save(replacement, manager);
          }
        }
      });
    });
  }

  async findActiveAddressForUser(user: User, id: string): Promise<Address> {
    this.ensureCustomer(user);
    const address = await this.addressesRepository.findActiveByIdForUser(
      id,
      user.id,
    );
    if (!address) {
      throw new NotFoundException('Address not found.');
    }
    return address;
  }

  private async requireActiveAddress(
    user: User,
    id: string,
    manager: Parameters<AddressesRepository['transaction']>[0] extends (
      manager: infer T,
    ) => Promise<unknown>
      ? T
      : never,
  ): Promise<Address> {
    const address = await this.addressesRepository.findActiveByIdForUser(
      id,
      user.id,
      manager,
    );
    if (!address) {
      throw new NotFoundException('Address not found.');
    }
    return address;
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException(
        'Only customers can manage delivery addresses.',
      );
    }
  }

  private applyUpdates(address: Address, dto: UpdateAddressDto): void {
    if (dto.label !== undefined) address.label = dto.label;
    if (dto.recipientName !== undefined)
      address.recipientName = dto.recipientName.trim();
    if (dto.phone !== undefined) address.phone = this.normalizePhone(dto.phone);
    if (dto.addressLine !== undefined)
      address.addressLine = dto.addressLine.trim();
    if (dto.locality !== undefined)
      address.locality = this.optionalText(dto.locality);
    if (dto.landmark !== undefined)
      address.landmark = this.optionalText(dto.landmark);
    if (dto.city !== undefined) address.city = dto.city.trim();
    if (dto.state !== undefined) address.state = this.optionalText(dto.state);
    if (dto.postalCode !== undefined)
      address.postalCode = dto.postalCode.trim();
    if (dto.country !== undefined)
      address.country = dto.country.trim() || 'India';
    if (dto.latitude !== undefined) address.latitude = dto.latitude;
    if (dto.longitude !== undefined) address.longitude = dto.longitude;
    if (dto.isDefault === false) address.isDefault = false;
  }

  private validateCoordinates(coordinates: {
    latitude?: number | null;
    longitude?: number | null;
  }): void {
    const hasLatitude =
      coordinates.latitude !== undefined && coordinates.latitude !== null;
    const hasLongitude =
      coordinates.longitude !== undefined && coordinates.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Latitude and longitude must be provided together.',
      );
    }
  }

  private normalizePhone(phone: string): string {
    return phone.trim().replace(/[\s()-]/g, '');
  }

  private optionalText(value: string | undefined): string | null {
    return value?.trim() || null;
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('Unable to update the default address.');
      }
      throw new InternalServerErrorException('Unable to update addresses.');
    }
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
