import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from "class-validator";

/** Exactly 10 numeric digits, nothing else. */
export const CALL_REFERENCE_REGEX = /^\d{10}$/;
export const CALL_REFERENCE_ERROR =
  "Call reference must be exactly 10 digits (numeric only).";

/**
 * Body for `POST /audits`.
 *
 * Creates a draft audit bound to a single agent + call reference.
 * The audit is automatically attached to the global default QA template
 * — supervisors do NOT pick a scorecard per audit. Any
 * `scorecardTemplateId` previously sent by older clients is rejected by
 * the strict ValidationPipe (`forbidNonWhitelisted`) so we surface the
 * change rather than ignoring it silently.
 */
export class CreateAuditDto {
  @IsString()
  @IsNotEmpty({ message: "Agent is required" })
  agentId!: string;

  @IsInt({ message: "Project must be a valid ID" })
  @Min(1)
  projectId!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: "Call reference is required" })
  @Matches(CALL_REFERENCE_REGEX, { message: CALL_REFERENCE_ERROR })
  callReference!: string;
}
