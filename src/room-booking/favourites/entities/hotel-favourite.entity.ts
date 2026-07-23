import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Column } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Hotel } from '../../hotels/entities/hotel.entity';

@Entity({ name: 'hotel_favourites' })
@Unique('UQ_hotel_favourites_user_hotel', ['userId', 'hotelId'])
export class HotelFavourite {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId!: string;

  @ManyToOne(() => Hotel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: Hotel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
