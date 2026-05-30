import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    root(): {
        service: string;
        status: string;
    };
    health(): {
        status: string;
        service: string;
        timestamp: string;
    };
}
