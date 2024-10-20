import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule,
    {
      transport: Transport.TCP,
      options: { port: envs.port }
    }
  )
  const logger = new Logger("Orders Microservice Main")
  

  await app.listen();

  logger.log(`Orders Microservice running on port ${envs.port}`)

}
bootstrap();
