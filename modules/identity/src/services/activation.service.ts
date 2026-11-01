import { Injectable } from '@nestjs/common';
import { RedisClientService } from '@unisaas/redis-client';

export interface ActivationData {
  code: string;
  userId: string;
  tenantId: string;
  branchId?: string | null;
  role: string;
  assignedRegister?: string;
  expiresAt: number;
}

@Injectable()
export class ActivationService {
  private readonly memoryStore = new Map<string, ActivationData>();

  constructor(private readonly redisClient?: RedisClientService) {}

  private getKey(email: string): string {
    return `unisaas:activation:${email.trim().toLowerCase()}`;
  }

  async saveActivation(email: string, data: ActivationData, ttlSeconds = 7 * 24 * 3600): Promise<void> {
    const normalized = email.trim().toLowerCase();
    this.memoryStore.set(normalized, data);

    if (this.redisClient) {
      try {
        await this.redisClient.set(this.getKey(normalized), JSON.stringify(data), ttlSeconds);
      } catch {
        // Fallback a memoria silencioso
      }
    }
  }

  async getActivation(email: string): Promise<ActivationData | null> {
    const normalized = email.trim().toLowerCase();

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.getKey(normalized));
        if (raw) {
          return JSON.parse(raw) as ActivationData;
        }
      } catch {
        // Fallback a memoria silencioso
      }
    }

    const memoryData = this.memoryStore.get(normalized);
    if (memoryData) {
      if (memoryData.expiresAt < Date.now()) {
        this.memoryStore.delete(normalized);
        return null;
      }
      return memoryData;
    }

    return null;
  }

  async deleteActivation(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    this.memoryStore.delete(normalized);

    if (this.redisClient) {
      try {
        await this.redisClient.del(this.getKey(normalized));
      } catch {
        // Fallback silencioso
      }
    }
  }
}
