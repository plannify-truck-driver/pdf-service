import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { RpcException } from "@nestjs/microservices";

interface GrpcContext {
  call?: {
    method?: string;
  };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;
    const fullMethodName = `${className}.${methodName}`;

    const rpcContext: GrpcContext = context.switchToRpc().getContext();
    const grpcMethod = rpcContext?.call?.method || fullMethodName;

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        console.log(
          `[${new Date().toISOString()}] gRPC Method: ${grpcMethod} | Status: OK | Duration: ${duration}ms`,
        );
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        let errorMessage = "Unknown error";
        if (error instanceof RpcException) {
          const errorValue = error.getError();
          errorMessage =
            typeof errorValue === "string"
              ? errorValue
              : JSON.stringify(errorValue);
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        console.error(
          `[${new Date().toISOString()}] gRPC Method: ${grpcMethod} | Status: ERROR | Duration: ${duration}ms | Error: ${errorMessage}`,
        );
        throw error;
      }),
    );
  }
}
