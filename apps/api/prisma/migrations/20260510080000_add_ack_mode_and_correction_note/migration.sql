-- Phase 2: Agent acknowledgement workflow + safe supervisor correction notes.
-- Acknowledgement now records the agent's stance (AGREED / DISAGREED)
-- and an optional remark (mandatory for DISAGREED). The supervisor
-- correction note lets supervisors append context to a locked
-- (PUBLISHED / REVIEWED) audit without mutating its score or answers.
ALTER TABLE `audits`
  ADD COLUMN `ack_mode` VARCHAR(24) NULL,
  ADD COLUMN `ack_remark` VARCHAR(1000) NULL,
  ADD COLUMN `supervisor_correction_note` TEXT NULL;
