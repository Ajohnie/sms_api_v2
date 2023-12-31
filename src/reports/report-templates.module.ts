import { Module } from "@nestjs/common";
import { ReportTemplatesController } from "./report-templates.controller";
import { ReportTemplatesService } from "./report-templates.service";

@Module({
  controllers: [ReportTemplatesController],
  imports: [],
  providers: [
    ReportTemplatesService],
  exports: [ReportTemplatesService]
})
export class ReportTemplatesModule {
}
