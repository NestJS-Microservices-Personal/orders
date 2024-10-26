import "dotenv/config"
import * as Joi from "joi"

interface EnvVars {
  PORT: number,
  DATABASE_URL: string ,
  PRODUCTS_MICROSERVICE_HOST: string,
  PRODUCTS_MICROSERVICE_PORT: number,
}

const envSchema = Joi.object({
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
  PRODUCTS_MICROSERVICE_HOST: Joi.string().required(),
  PRODUCTS_MICROSERVICE_PORT: Joi.number().required(),
}).unknown();

const { error, value } = envSchema.validate(process.env, { abortEarly: false})

if (error) throw new Error('Config validation error: ' + error);

const envVars:EnvVars = value;

export const envs = {
  port: envVars.PORT,
  databaseurl: envVars.DATABASE_URL,
  productsMicroserviceHost: envVars.PRODUCTS_MICROSERVICE_HOST,
  productsMicroservicePort: envVars.PRODUCTS_MICROSERVICE_PORT,
}
