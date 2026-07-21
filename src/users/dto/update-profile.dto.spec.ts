import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('accepts valid profile updates', async () => {
    const errors = await validate(
      plainToInstance(UpdateProfileDto, {
        name: 'User Name',
        email: 'user@example.com',
        phone: '+918888888888',
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid profile updates', async () => {
    const errors = await validate(
      plainToInstance(UpdateProfileDto, {
        name: 'A',
        email: 'not-an-email',
        phone: '8888888888',
      }),
    );

    expect(errors).toHaveLength(3);
  });
});
