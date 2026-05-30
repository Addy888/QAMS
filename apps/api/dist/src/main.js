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
require("class-validator");
require("class-transformer");
const http = __importStar(require("http"));
async function bootstrap() {
    process.on("uncaughtException", (err) => {
        console.error("[FATAL] uncaughtException:", err.message);
        console.error(err.stack);
    });
    process.on("unhandledRejection", (reason) => {
        console.error("[FATAL] unhandledRejection:", reason?.message ?? reason);
        if (reason?.stack)
            console.error(reason.stack);
    });
    console.log("=== QAMS BOOTSTRAP START ===");
    console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
    console.log(`DATABASE_URL = ${process.env.DATABASE_URL ? "[SET]" : "[MISSING]"}`);
    console.log(`OLLAMA_URL = ${process.env.OLLAMA_URL ?? "[NOT SET]"}`);
    console.log(`LOCAL_PYTHON_BIN = ${process.env.LOCAL_PYTHON_BIN ?? "[NOT SET]"}`);
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    try {
        console.log("[BOOT] Creating NestFactory...");
        const app = await core_1.NestFactory.create(app_module_1.AppModule, {
            logger: ["error", "warn", "log", "debug", "verbose"],
        });
        console.log("[BOOT] NestFactory created successfully.");
        app.enableCors();
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.listen(PORT);
        console.log(`[BOOT] QAMS API running on port ${PORT} 🚀`);
    }
    catch (e) {
        console.error("=========================================");
        console.error("BOOTSTRAP CRASH DETECTED");
        console.error(`ERROR: ${e.message}`);
        console.error(`STACK:\n${e.stack}`);
        console.error("=========================================");
        console.error("[BOOT] Starting graceful fallback HTTP server to prevent Vercel 500 error.");
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
//# sourceMappingURL=main.js.map