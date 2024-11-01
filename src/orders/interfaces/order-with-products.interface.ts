import { OrderStatus } from '@prisma/client'

export interface OrderWithProducts{
  id:string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus;
  paid: boolean;
  paidAt: Date;
  createAt: Date;
  updateAt: Date;
  
  OrderItem:{
    name: string;
    productId: string;
    quantity: number;
    price: number;
  }[];
}