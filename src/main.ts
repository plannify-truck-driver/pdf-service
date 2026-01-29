import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { join } from "path";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: "plannify",
        protoPath: join(__dirname, "proto/workdays.proto"),
        url: "0.0.0.0:8084",
      },
    },
  );

  await app.listen();
}

bootstrap().catch((err) => {
  console.error("Error starting application", err);
});
