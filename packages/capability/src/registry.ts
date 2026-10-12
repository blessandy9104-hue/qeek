import type { Capability, CapabilityCategory, CapabilityStatus } from './types';

interface ListFilter {
  category?: string;
  status?: string;
}

export class CapabilityRegistry {
  private ctx: any;
  private map = new Map<string, Capability>();

  constructor(ctx: any) {
    this.ctx = ctx;
  }

  register(cap: Capability): void {
    this.map.set(cap.name, cap);
  }

  unregister(name: string): void {
    this.map.delete(name);
  }

  get(name: string): Capability | undefined {
    return this.map.get(name);
  }

  getAll(): Capability[] {
    return [...this.map.values()];
  }

  has(name: string): boolean {
    const cap = this.map.get(name);
    return !!cap && cap.status === 'available';
  }

  list(filter?: ListFilter): Capability[] {
    let all = this.getAll();
    if (filter?.category) all = all.filter((c) => c.category === filter.category);
    if (filter?.status) all = all.filter((c) => c.status === filter.status);
    return all;
  }

  byCategory(category: CapabilityCategory): Capability[] {
    return this.list({ category });
  }

  available(): Capability[] {
    return this.list({ status: 'available' satisfies CapabilityStatus });
  }
}
