import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

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
      
      // We wrap the connect call in a timeout promise to prevent Vercel from hanging forever on bad DB urls
      const connectPromise = this.$connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timed out after 10000ms")), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.logger.log("[Prisma] Database connected successfully.");
      this.logger.log("=========================================");
    } catch (error: any) {
      this.logger.error("=========================================");
      this.logger.error(`[Prisma] DATABASE CONNECTION CRASH DETECTED`);
      this.logger.error(`[Prisma] ERROR: ${error.message}`);
      this.logger.error(`[Prisma] DATABASE_URL starts with: ${(process.env.DATABASE_URL || "").substring(0, 40)}...`);
      this.logger.error(`[Prisma] Full stack trace:\n${error.stack}`);
      this.logger.error("[Prisma] GRACEFUL FALLBACK: Application will continue to boot without DB connection, but endpoints will fail.");
      this.logger.error("=========================================");
      // DO NOT re-throw — let the app boot so we can see logs on Vercel
    }
  }
}