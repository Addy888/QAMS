import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const defaultPort = 3000;
  const PORT = await getAvailablePort(defaultPort);
  await app.listen(PORT);
  console.log(`QAMS API running on port ${PORT} 🚀`);
}
bootstrap();
