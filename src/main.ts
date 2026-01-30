import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { join } from "path";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { LoggingInterceptor } from "./logging.interceptor";

const checkEnvVariables = () => {
  const requiredEnvVars = ["HOST", "PORT", "WEBSITE_URL"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }
};

async function bootstrap() {
  checkEnvVariables();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: "plannify",
        protoPath: join(__dirname, "proto/workdays.proto"),
        url: `${process.env.HOST}:${process.env.PORT}`,
        loader: {
          longs: String,
          enums: Number,
          defaults: true,
          oneofs: true,
        },
      },
    },
  );

  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen();
}

bootstrap().catch((err) => {
  console.error("Error starting application", err);
});
