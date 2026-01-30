import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import {
  GenerateMonthlyWorkdayReportRequest,
  GenerateMonthlyWorkdayReportResponse,
} from "../proto/workdays";
import { WorkdayService } from "./workday.service";

@Controller()
export class WorkdayController {
  constructor(private readonly workdayService: WorkdayService) {}

  @GrpcMethod("WorkdayService", "GenerateMonthlyWorkdayReport")
  async generateMonthlyWorkdayReport(
    data: GenerateMonthlyWorkdayReportRequest,
  ): Promise<GenerateMonthlyWorkdayReportResponse> {
    const pdfContent =
      await this.workdayService.generateMonthlyWorkdayPdf(data);

    return {
      pdfContent,
    };
  }
}
