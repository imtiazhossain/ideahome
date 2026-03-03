import { Module } from "@nestjs/common";
import { TaxDocumentsController } from "./tax-documents.controller";
import { TaxDocumentsService } from "./tax-documents.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";
import { MalwareScannerService } from "../malware-scanner.service";

@Module({
  controllers: [TaxDocumentsController],
  providers: [
    TaxDocumentsService,
    PrismaService,
    StorageService,
    MalwareScannerService,
  ],
})
export class TaxDocumentsModule {}
