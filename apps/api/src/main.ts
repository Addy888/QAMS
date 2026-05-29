import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import 'class-validator';
import 'class-transformer';
import { execSync } from "child_process";
import * as net from "net";

function getProcessOnPort(port: number): string | null {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes("LISTENING")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid) {
          return pid;
        }
      }
    }
  } catch (err) {
    // Ignore error (e.g. netstat exits with 1 if no process found)
  }
  return null;
}

function killProcess(pid: string): boolean {
  try {
    const currentPid = process.pid.toString();
    if (pid === currentPid) {
      console.log(`[Port Handler] Target PID ${pid} is the current process. Skipping self-kill.`);
      return false;
    }
    console.log(`[Port Handler] Killing process ${pid} on Windows using taskkill...`);
    execSync(`taskkill /F /PID ${pid}`);
    return true;
  } catch (err: any) {
    console.error(`[Port Handler] Failed to kill process ${pid}:`, err.message);
    return false;
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function getAvailablePort(defaultPort: number): Promise<number> {
  const ports = [defaultPort, defaultPort + 1, defaultPort + 2];
  for (const port of ports) {
    let available = await isPortAvailable(port);
    if (!available) {
      console.log(`[Port Handler] Port ${port} is occupied.`);
      const pid = getProcessOnPort(port);
      if (pid) {
        const killed = killProcess(pid);
        if (killed) {
          // Wait a brief moment for socket to be freed
          await new Promise((resolve) => setTimeout(resolve, 1000));
          available = await isPortAvailable(port);
        }
      }
    }
    
    if (available) {
      return port;
    }
    console.log(`[Port Handler] Port ${port} is still occupied. Trying next port...`);
  }
  return defaultPort;
}

async function runPreFlightChecks() {
  console.log("--- STARTING PRE-FLIGHT DIAGNOSTICS ---");
  
  // 1. Env Variables
  const requiredEnv = ['DATABASE_URL', 'OLLAMA_URL', 'LOCAL_PYTHON_BIN'];
  for (const env of requiredEnv) {
    if (!process.env[env]) console.error(`[DIAGNOSTIC ERROR] Missing ENV VAR: ${env}`);
    else console.log(`[DIAGNOSTIC OK] ${env} = ${process.env[env]}`);
  }

  // 2. Prisma Connection
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log("[DIAGNOSTIC OK] Prisma Database Connected.");
    await prisma.$disconnect();
  } catch (e: any) {
    console.error(`[DIAGNOSTIC ERROR] Prisma Connection Failed: ${e.message}`);
    console.error(e.stack);
  }

  // 3. Ollama Connection
  try {
    const axios = require('axios');
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    await axios.get(ollamaUrl, { timeout: 2000 });
    console.log("[DIAGNOSTIC OK] Ollama is reachable.");
  } catch (e: any) {
    console.error(`[DIAGNOSTIC ERROR] Ollama Connection Failed: ${e.message}`);
  }

  // 4. Python Executable
  try {
    const { execSync } = require('child_process');
    const pyBin = process.env.LOCAL_PYTHON_BIN || 'python';
    const pyVer = execSync(`"${pyBin}" --version`, { encoding: 'utf8' }).trim();
    console.log(`[DIAGNOSTIC OK] Python found: ${pyVer}`);
  } catch (e: any) {
    console.error(`[DIAGNOSTIC ERROR] Python Executable Failed: ${e.message}`);
  }

  console.log("--- END PRE-FLIGHT DIAGNOSTICS ---");
}

async function bootstrap() {
  process.on('uncaughtException', (err) => {
    console.error("FATAL UNCAUGHT EXCEPTION:", err);
    console.error(err.stack);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error("FATAL UNHANDLED REJECTION:", reason);
  });

  try {
    await runPreFlightChecks();

    console.log("Initializing NestJS Application...");
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'debug', 'log', 'verbose'], // ULTRA VERBOSE LOGGING
    });

    app.enableCors();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const defaultPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const PORT = await getAvailablePort(defaultPort);
    await app.listen(PORT);
    console.log(`QAMS API running on port ${PORT} 🚀`);
  } catch (e: any) {
    console.error("=========================================");
    console.error("BOOTSTRAP CRASH DETECTED");
    console.error(`ERROR MESSAGE: ${e.message}`);
    console.error(`STACK TRACE:\n${e.stack}`);
    console.error("=========================================");
    process.exit(1);
  }
}
bootstrap();
