import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ChangeOrderStatusDto, CreateOrderDto, PaginationOrderDto } from './dto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  public get productClient(): ClientProxy {
    return this._productClient;
  }

  private readonly logger = new Logger('Orders Service');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  constructor(
    @Inject(NATS_SERVICE)
    private readonly _productClient: ClientProxy
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
        message: 'Product Id not found',
        status: HttpStatus.BAD_REQUEST
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
      OrderItem: orderByID.OrderItem.map(orderItem =>  {
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

}
