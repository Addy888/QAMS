import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { Role } from "../../auth/role.enum";

/**
 * Payload accepted by `POST /users`.
 *
 * Only SUPERVISOR and AGENT can be created through this endpoint —
 * `ADMIN` is intentionally excluded so it cannot be self-elevated.
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "First name is required" })
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: "Last name is required" })
  @MaxLength(60)
  lastName!: string;

  @IsString()
  @IsNotEmpty({ message: "Username is required" })
  @MinLength(3, { message: "Username must be at least 3 characters" })
  @MaxLength(60)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      "Username may only contain letters, numbers, dots, hyphens and underscores",
  })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(100)
  password!: string;

  @IsIn(["SUPERVISOR", "AGENT"], {
    message: "Role must be SUPERVISOR or AGENT",
  })
  role!: Exclude<Role, "ADMIN">;
}
