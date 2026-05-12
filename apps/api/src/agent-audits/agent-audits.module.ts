import { Module } from "@nestjs/common";
import { AgentAuditsController } from "./agent-audits.controller";
import { AgentAuditsService } from "./agent-audits.service";
import { AuditsModule } from "../audits/audits.module";

/**
 * Agent-facing slice of the audit lifecycle. Reuses `AuditsService.getById`
 * for the detail / acknowledge response shapes so the wire format stays
 * consistent between supervisor and agent views.
 */
@Module({
  imports: [AuditsModule],
  controllers: [AgentAuditsController],
  providers: [AgentAuditsService],
})
export class AgentAuditsModule {}
