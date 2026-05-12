import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Agent acknowledgement payload. The agent picks one of two stances:
 *
 *   - "AGREED"    → audit is accepted, remark optional
 *   - "DISAGREED" → audit is disputed, remark required (≥ 5 chars)
 *
 * The service layer enforces the "remark required" rule so the wire
 * shape stays simple.
 */
export const ACK_MODES = ["AGREED", "DISAGREED"] as const;
export type AckMode = (typeof ACK_MODES)[number];

export class AcknowledgeAuditDto {
  @IsString()
  @IsIn(ACK_MODES, {
    message: "mode must be either 'AGREED' or 'DISAGREED'",
  })
  mode!: AckMode;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000, { message: "Remark must be 1000 characters or fewer" })
  remark?: string;
}
