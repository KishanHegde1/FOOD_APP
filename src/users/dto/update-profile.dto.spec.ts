import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCurrentUserProfileDto } from './update-profile.dto';

describe('UpdateCurrentUserProfileDto', () => {
  it('accepts a valid shared profile update and trims text fields', async () => {
    const dto = plainToInstance(UpdateCurrentUserProfileDto, {
      fullName: '  Kishan Hegde  ',
      email: ' KISHAN@EXAMPLE.COM ',
      phoneNumber: '+919876543210',
      dateOfBirth: '2000-05-12',
      gender: 'PREFER_NOT_TO_SAY',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.fullName).toBe('Kishan Hegde');
    expect(dto.email).toBe('KISHAN@EXAMPLE.COM');
  });

  it.each([
    [{ email: 'not-an-email' }],
    [{ dateOfBirth: '2999-01-01' }],
    [{ dateOfBirth: '2026-02-30' }],
  ])('rejects invalid profile input %#', async (input) => {
    const dto = plainToInstance(UpdateCurrentUserProfileDto, input);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
