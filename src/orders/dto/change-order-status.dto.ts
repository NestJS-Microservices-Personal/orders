import { OrderStatus } from "@prisma/client";
import { IsEnum, IsUUID } from "class-validator";
import { OrderStatusList } from "../enum/orders.enum";

export class ChangeOrderStatusDto {
  @IsUUID()
  id: string;

  @IsEnum(
    OrderStatusList,
    { message: `Valid status are ${ OrderStatusList }`}
  )
  status : OrderStatus
}