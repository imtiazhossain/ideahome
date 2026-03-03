import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { MalwareScannerService } from "./malware-scanner.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly malwareScanner: MalwareScannerService
  ) {}

  @Get("/")
  getHealth() {
    return { status: "ok" };
  }

  @Get("/health/malware-scanner")
  getMalwareScannerHealth() {
    return this.malwareScanner.healthCheck();
  }
}
