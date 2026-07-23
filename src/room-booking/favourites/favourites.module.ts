import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelFavourite } from './entities/hotel-favourite.entity';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotelFavourite, Hotel]),
    AuthModule,
    UsersModule,
  ],
  controllers: [FavouritesController],
  providers: [FavouritesService],
})
export class FavouritesModule {}
