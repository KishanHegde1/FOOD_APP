import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { UserGender } from '../entities/user.entity';

@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return false;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return parsed <= today;
  }

  defaultMessage(): string {
    return 'dateOfBirth must be a valid ISO date that is not in the future.';
  }
}

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateCurrentUserProfileDto {
  @ApiPropertyOptional({
    example: 'Kishan Hegde',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @Transform(trimString)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+918888888888',
    description:
      'Optional E.164 phone number. Changes must be completed through Firebase OTP verification.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^\+\d{6,15}$/, {
    message: 'phoneNumber must be a valid international phone number.',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '2000-05-12',
    format: 'date',
    description: 'Optional ISO date of birth. It cannot be in the future.',
  })
  @IsOptional()
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  @Validate(IsNotFutureDateConstraint)
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Compatibility alias for fullName. Prefer fullName.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Compatibility alias for phoneNumber. Prefer phoneNumber.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^\+\d{6,15}$/)
  phone?: string;
}

/** @deprecated Use UpdateCurrentUserProfileDto. */
export class UpdateProfileDto extends UpdateCurrentUserProfileDto {}
