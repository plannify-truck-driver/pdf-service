import { Module } from "@nestjs/common";
import { WorkdayModule } from "./workdays/workday.module";

@Module({
  imports: [WorkdayModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
