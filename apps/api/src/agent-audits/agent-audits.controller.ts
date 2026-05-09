import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../auth/current-user.decorator";
import { Role } from "../auth/role.enum";
import { AgentAuditsService } from "./agent-audits.service";

/**
 * Agent-only audit endpoints.
 *
 *   GET   /agent/audits                — list own visible audits
 *   GET   /agent/audits/:id            — detail (visibility + ownership enforced)
 *   PATCH /agent/audits/:id/review     — acknowledge feedback (PUBLISHED → REVIEWED)
 *   GET   /agent/summary               — dashboard counters
 *
 * All filtering happens on the server: the client cannot widen the
 * scope by passing a different agent id or status filter.
 */
@Controller("agent")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentAuditsController {
  constructor(private readonly agentAudits: AgentAuditsService) {}

  @Get("audits")
  @Roles("AGENT")
  async list(@CurrentUser() actor: CurrentUserPayload) {
    return this.agentAudits.list({
      id: actor.id,
      role: actor.role as Role,
    });
  }

  @Get("audits/:id")
  @Roles("AGENT")
  async detail(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.agentAudits.getById(id, {
      id: actor.id,
      role: actor.role as Role,
    });
  }

  @Patch("audits/:id/review")
  @Roles("AGENT")
  async acknowledge(
    @CurrentUser() actor: CurrentUserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.agentAudits.acknowledge(id, {
      id: actor.id,
      role: actor.role as Role,
    });
  }

  @Get("summary")
  @Roles("AGENT")
  async summary(@CurrentUser() actor: CurrentUserPayload) {
    return this.agentAudits.summary({
      id: actor.id,
      role: actor.role as Role,
    });
  }
}
