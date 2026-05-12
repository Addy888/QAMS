import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Body for `PATCH /audits/:id/correction-note`.
 *
 * Lets a supervisor append (or clear) a correction note on an already-
 * published / reviewed audit. The note is a separate, append-only field;
 * it never mutates the audit's score, answers, or overall comment, so
 * the immutable-after-publish promise is preserved.
 *
 * Pass `note: null` to clear the note. Trims whitespace.
 */
export class CorrectionNoteDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null) return null;
    if (typeof value === "string") {
      const t = value.trim();
      return t.length === 0 ? null : t;
    }
    return value;
  })
  @IsString()
  @MaxLength(2000, {
    message: "Correction note must be 2000 characters or fewer",
  })
  note?: string | null;
}
