import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderStatusDto, PaginationOrderDto } from './dto';
import { PaidOrderDto } from './dto/paid-order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @MessagePattern({ cmd: 'createOrder' })
  async create(@Payload() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);
    const paymentSession = await this.ordersService.createPaymentSession(order)

    return {
      order,
      paymentSession
    }
  }

  @MessagePattern({ cmd: 'findAllOrders' })
  findAll(@Payload() paginationOrderDto : PaginationOrderDto) {
    return this.ordersService.findAll( paginationOrderDto);
  }

  @MessagePattern({ cmd: 'findOneOrder' })
  findOne(@Payload('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern({ cmd: 'changeOrderStatus'})
  changeOrderStatus(@Payload() changeOrderStatusDto: ChangeOrderStatusDto){
    return this.ordersService.changeStatus(changeOrderStatusDto);
  }

  @EventPattern({ cmd: 'order.payment.success' })
  paidOrder(@Payload() paidOrderDto: PaidOrderDto) {
    console.log({paidOrderDto})
    return this.ordersService.paidOrder(paidOrderDto);
  }

}
