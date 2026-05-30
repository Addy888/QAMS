import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  root() {
    return {
      service: 'QAMS API',
      status: 'running'
    };
  }

  @Get('/health')
  health() {
    return {
      status: 'healthy',
      service: 'QAMS API',
      timestamp: new Date().toISOString()
    };
  }
}
