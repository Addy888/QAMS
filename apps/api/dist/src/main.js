"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const child_process_1 = require("child_process");
const net = __importStar(require("net"));
function getProcessOnPort(port) {
    try {
        const output = (0, child_process_1.execSync)(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
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
    }
    catch (err) {
    }
    return null;
}
function killProcess(pid) {
    try {
        const currentPid = process.pid.toString();
        if (pid === currentPid) {
            console.log(`[Port Handler] Target PID ${pid} is the current process. Skipping self-kill.`);
            return false;
        }
        console.log(`[Port Handler] Killing process ${pid} on Windows using taskkill...`);
        (0, child_process_1.execSync)(`taskkill /F /PID ${pid}`);
        return true;
    }
    catch (err) {
        console.error(`[Port Handler] Failed to kill process ${pid}:`, err.message);
        return false;
    }
}
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", (err) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            }
            else {
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
async function getAvailablePort(defaultPort) {
    const ports = [defaultPort, defaultPort + 1, defaultPort + 2];
    for (const port of ports) {
        let available = await isPortAvailable(port);
        if (!available) {
            console.log(`[Port Handler] Port ${port} is occupied.`);
            const pid = getProcessOnPort(port);
            if (pid) {
                const killed = killProcess(pid);
                if (killed) {
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
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const defaultPort = 3000;
    const PORT = await getAvailablePort(defaultPort);
    await app.listen(PORT);
    console.log(`QAMS API running on port ${PORT} 🚀`);
}
bootstrap();
//# sourceMappingURL=main.js.map