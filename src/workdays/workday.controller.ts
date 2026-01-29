import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { Metadata } from "@grpc/grpc-js";
import type { ServerUnaryCall } from "@grpc/grpc-js";
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
    _data: GenerateMonthlyWorkdayReportRequest,
    _metadata: Metadata,
    _call: ServerUnaryCall<any, any>,
  ): Promise<GenerateMonthlyWorkdayReportResponse> {
    const pdfContent = await this.workdayService.generateMonthlyWorkdayPdf();

    return {
      pdfContent,
    };
  }
}
