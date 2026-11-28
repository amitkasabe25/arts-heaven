import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault)
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          userId,
          label: dto.label,
          name: dto.name,
          phone: dto.phone,
          addressLine: dto.addressLine,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const address = await this.own(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault)
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id: address.id }, data: dto });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.own(userId, id);
    await this.prisma.address.delete({ where: { id: address.id } });
  }

  async setDefault(userId: string, id: string) {
    await this.own(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  private async own(userId: string, id: string) {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not your address');
    return address;
  }
}
