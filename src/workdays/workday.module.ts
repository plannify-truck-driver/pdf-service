import { Module } from "@nestjs/common";
import { WorkdayController } from "./workday.controller";
import { WorkdayService } from "./workday.service";

@Module({
  imports: [],
  controllers: [WorkdayController],
  providers: [WorkdayService],
})
export class WorkdayModule {}
