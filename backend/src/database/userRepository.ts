/**
 * User Repository — Omni One Backend
 */

import { BaseRepository } from "./baseRepository.js";
import type { User, Prisma } from "@prisma/client";

export class UserRepository extends BaseRepository {
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  async list(params: { skip?: number; take?: number } = {}): Promise<User[]> {
    return this.prisma.user.findMany({
      ...params,
      orderBy: { createdAt: "desc" },
    });
  }
}

export const userRepository = new UserRepository();
