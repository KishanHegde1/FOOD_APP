/* eslint-disable @typescript-eslint/no-unsafe-return */
import { NotFoundException } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { HotelFavourite } from './entities/hotel-favourite.entity';
import { FavouritesService } from './favourites.service';

describe('FavouritesService', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111' } as User;
  const hotelId = '22222222-2222-4222-8222-222222222222';

  function createService(existing: HotelFavourite | null = null) {
    const favouritesRepository = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const hotelsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: hotelId, isActive: true }),
    };
    return {
      service: new FavouritesService(
        favouritesRepository as never,
        hotelsRepository as never,
      ),
      favouritesRepository,
      hotelsRepository,
    };
  }

  it('adds favourites idempotently without inserting duplicates', async () => {
    const existing = {
      id: 'fav-id',
      userId: user.id,
      hotelId,
    } as HotelFavourite;
    const { service, favouritesRepository } = createService(existing);

    await expect(service.add(user, hotelId)).resolves.toEqual({
      hotelId,
      isFavourite: true,
    });
    expect(favouritesRepository.save).not.toHaveBeenCalled();
  });

  it('does not let a favourite be created for an inactive or missing hotel', async () => {
    const { service, hotelsRepository, favouritesRepository } = createService();
    hotelsRepository.findOne.mockResolvedValue(null);

    await expect(service.add(user, hotelId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(favouritesRepository.save).not.toHaveBeenCalled();
  });

  it('deletes by both authenticated user and hotel ID', async () => {
    const { service, favouritesRepository } = createService();

    await expect(service.remove(user, hotelId)).resolves.toEqual({
      hotelId,
      isFavourite: false,
    });
    expect(favouritesRepository.delete).toHaveBeenCalledWith({
      userId: user.id,
      hotelId,
    });
  });
});
