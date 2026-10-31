import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignUpDto {
  /**
   * Trimmed and lowercased before validation.
   * @example "jane.doe@example.com"
   */
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** @example "s3cureP@ssw0rd" */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  /** @example "Jane" */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  /** @example "Doe" */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
