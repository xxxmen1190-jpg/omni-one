/**
 * Conversation Repository — Omni One Backend
 */

import { BaseRepository } from "./baseRepository.js";
import type { Conversation, Prisma } from "@prisma/client";

export class ConversationRepository extends BaseRepository {
  async findById(id: string, includeMessages = false): Promise<any | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: includeMessages },
    });
  }

  async listByUser(userId: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return this.prisma.conversation.create({ data });
  }

  async update(id: string, data: Prisma.ConversationUpdateInput): Promise<Conversation> {
    return this.prisma.conversation.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Conversation> {
    return this.prisma.conversation.delete({ where: { id } });
  }

  async addMessage(conversationId: string, data: Prisma.MessageCreateWithoutConversationInput) {
    return this.transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          ...data,
          conversation: { connect: { id: conversationId } },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }
}

export const conversationRepository = new ConversationRepository();
