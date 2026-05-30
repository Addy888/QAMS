"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    async onModuleInit() {
        try {
            this.logger.log("=========================================");
            this.logger.log("[Prisma] INITIALIZING SERVICE...");
            this.logger.log(`[Prisma] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
            const dbUrl = process.env.DATABASE_URL || "";
            const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
            if (isLocalhost) {
                this.logger.error("[Prisma] WARNING: DATABASE_URL points to localhost — this WILL fail on Vercel unless you use a hosted DB!");
            }
            this.logger.log("[Prisma] Connecting to database...");
            const connectPromise = this.$connect();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database connection timed out after 10000ms")), 10000));
            await Promise.race([connectPromise, timeoutPromise]);
            this.logger.log("[Prisma] Database connected successfully.");
            this.logger.log("=========================================");
        }
        catch (error) {
            this.logger.error("=========================================");
            this.logger.error(`[Prisma] DATABASE CONNECTION CRASH DETECTED`);
            this.logger.error(`[Prisma] ERROR: ${error.message}`);
            this.logger.error(`[Prisma] DATABASE_URL starts with: ${(process.env.DATABASE_URL || "").substring(0, 40)}...`);
            this.logger.error(`[Prisma] Full stack trace:\n${error.stack}`);
            this.logger.error("[Prisma] GRACEFUL FALLBACK: Application will continue to boot without DB connection, but endpoints will fail.");
            this.logger.error("=========================================");
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
//# sourceMappingURL=prisma.service.js.map