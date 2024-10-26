import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "src/common";
import { OrderStatusList } from "../enum/orders.enum";
import { OrderStatus } from "@prisma/client";

export class PaginationOrderDto extends PaginationDto {
  @IsOptional()
  @IsEnum(
    OrderStatusList, {
      message:`Valid status are ${OrderStatusList}`
     })
  status: OrderStatus
}