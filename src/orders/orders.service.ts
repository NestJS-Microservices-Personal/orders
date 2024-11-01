import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ChangeOrderStatusDto, CreateOrderDto, PaginationOrderDto } from './dto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';
import { PaidOrderDto } from './dto/paid-order.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

 private readonly logger = new Logger('Orders Service');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  constructor(
    @Inject(NATS_SERVICE)
    private readonly productClient: ClientProxy
  ) {
    super()
  }

  async create(createOrderDto: CreateOrderDto) {

    try {
      const productsId = createOrderDto.items.map(item => item.productId)
      const products: any[] = await firstValueFrom(
        this.productClient.send({ cmd: 'validate_products' }, productsId)
      )

      const productsIndex = products.reduce((acc, item) => {
        acc[item.id] = item
        return acc
      }, [])

      const totalAmount: number = createOrderDto.items.reduce((acc, orderItem) => {
        const price = productsIndex[orderItem.productId].price;
        return price * orderItem.quantity
      }, 0)
      const totalItems = createOrderDto.items.reduce((acc, orderItem) => acc + orderItem.quantity, 0)


      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(orderItem => ({
                productId: orderItem.productId,
                price: productsIndex[orderItem.productId].price,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      })

      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItem => ({
          name: productsIndex[orderItem.productId].name,
          ...orderItem
        }))
      }

    } catch (error) {
      throw new RpcException({
        message: 'Products Ids not found',
        status: HttpStatus.NOT_FOUND
      })
    }
  }

  async findAll(paginationOrderDto: PaginationOrderDto) {
    const { page, limit, status } = paginationOrderDto

    const totalPage = await this.order.count({
      where: { status },
    });
    const lastPage = Math.ceil(totalPage / limit);

    const meta = {
      total: totalPage,
      page,
      lastPage
    }
    const data = await this.order.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where: { status },
    })

    return {
      meta,
      data
    };
  }

  async findOne(id: string) {
    const orderByID = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: true
      }
    });

    if (!orderByID) throw new RpcException({
      status: HttpStatus.NOT_FOUND,
      message: `Order with id ${id} not found`
    })

    const productsId = orderByID.OrderItem.map(item => item.productId)

    const products: any[] = await firstValueFrom(
      this.productClient.send({ cmd: 'validate_products' }, productsId)
    )

    const productsIndex = products.reduce((acc, item) => {
      acc[item.id] = item
      return acc
    }, [])

    return {
      ...orderByID,
      OrderItem: orderByID.OrderItem.map(orderItem => {
        if (orderItem.orderId === orderByID.id) {
          return {
            productId: orderItem.productId,
            name: productsIndex[orderItem.productId].name,
            price: productsIndex[orderItem.productId].price,
            quantity: orderItem.quantity
          }
        }
      })
    }
  };

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto

    const orderByID = await this.findOne(id);
    if (orderByID.status === status) return orderByID;

    return this.order.update({
      where: { id },
      data: { status }
    })
  }

  async createPaymentSession(order: OrderWithProducts) {
    try {
      const paymentSession = await firstValueFrom(
        this.productClient.send({ cmd: 'create.payment.session' }, {
          orderId: order.id,
          currency: 'EUR',
          items: order.OrderItem.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        })
      )

      return paymentSession

    } catch (error) {
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error creating payment session'

      })
    }
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    const { orderId, stripePaymentId, receiptUrl } = paidOrderDto

    await this.findOne(orderId);

    const updateOrder = await this.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: stripePaymentId,

        OrderReceipt: {
          create: {
            receiptUrl
          }
        }
      }
    })
    return updateOrder;
  }

}
