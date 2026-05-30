import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import "class-validator";
import "class-transformer";
import * as http from "http";

async function bootstrap() {
  // ── Global crash handlers (print to Vercel logs) ──
  process.on("uncaughtException", (err) => {
    console.error("[FATAL] uncaughtException:", err.message);
    console.error(err.stack);
  });
  process.on("unhandledRejection", (reason: any) => {
    console.error("[FATAL] unhandledRejection:", reason?.message ?? reason);
    if (reason?.stack) console.error(reason.stack);
  });

  console.log("=== QAMS BOOTSTRAP START ===");
  console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
  console.log(`DATABASE_URL = ${process.env.DATABASE_URL ? "[SET]" : "[MISSING]"}`);
  console.log(`OLLAMA_URL = ${process.env.OLLAMA_URL ?? "[NOT SET]"}`);
  console.log(`LOCAL_PYTHON_BIN = ${process.env.LOCAL_PYTHON_BIN ?? "[NOT SET]"}`);

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  try {
    console.log("[BOOT] Creating NestFactory...");
    const app = await NestFactory.create(AppModule, {
      logger: ["error", "warn", "log", "debug", "verbose"],
    });
    console.log("[BOOT] NestFactory created successfully.");

    app.enableCors();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.listen(PORT);
    console.log(`[BOOT] QAMS API running on port ${PORT} 🚀`);
  } catch (e: any) {
    console.error("=========================================");
    console.error("BOOTSTRAP CRASH DETECTED");
    console.error(`ERROR: ${e.message}`);
    console.error(`STACK:\n${e.stack}`);
    console.error("=========================================");
    console.error("[BOOT] Starting graceful fallback HTTP server to prevent Vercel 500 error.");
    
    // Fallback server so Vercel doesn't crash the lambda abruptly.
    const fallbackServer = http.createServer((req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        error: "Application failed to start.",
        message: e.message,
        stack: process.env.NODE_ENV === 'production' ? "Hidden in production" : e.stack
      }));
    });

    fallbackServer.listen(PORT, () => {
      console.log(`[BOOT] Graceful fallback server listening on port ${PORT}`);
    });
  }
}

bootstrap();
