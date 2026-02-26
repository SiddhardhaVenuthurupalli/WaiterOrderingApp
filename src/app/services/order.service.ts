import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface TableInfo {
  id: number | string;
  name?: string;
  status?: string;
}

export interface MenuCategory {
  id: number | string;
  name?: string;
}

export interface MenuItem {
  id: number | string;
  name?: string;
  price?: number;
}

export interface OrderItem {
  id: number | string;
  name?: string;
  price?: number;
  quantity: number;
  remark?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly targetIpPattern =
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

  private isWeb(): boolean {
    return window.location.protocol.startsWith('http');
  }

  private getTargetIp(): string {
    return this.normalizeTargetIp(localStorage.getItem('targetIp') ?? '');
  }

  private getApiHost(): string {
    if (this.isWeb()) {
      return '/proxy';
    }
    const targetIp = this.getTargetIp();
    return `http://${targetIp || '127.0.0.1'}:5000`;
  }

  private getApiBase(): string {
    return `${this.getApiHost()}/api/v1`;
  }

  private getHeaders(): HttpHeaders | undefined {
    if (!this.isWeb()) {
      return undefined;
    }
    const targetIp = this.getTargetIp();
    return targetIp ? new HttpHeaders({ 'x-target-ip': targetIp }) : undefined;
  }

  normalizeTargetIp(value: string): string {
    const trimmed = value.trim();
    return this.targetIpPattern.test(trimmed) ? trimmed : '';
  }

  isValidTargetIp(value: string): boolean {
    return this.normalizeTargetIp(value) !== '';
  }

  normalizeList<T>(data: T[] | { items?: T[]; data?: T[] } | null | undefined): T[] {
    if (Array.isArray(data)) {
      return data;
    }
    if (data?.items) {
      return data.items;
    }
    if (data?.data) {
      return data.data;
    }
    return [];
  }

  getTables() {
    return this.http.get<TableInfo[]>(`${this.getApiBase()}/tables`, { headers: this.getHeaders() });
  }

  getTableStatus(id: number | string) {
    return this.http.get<{ status?: string }>(`${this.getApiBase()}/tables/${id}/status`, { headers: this.getHeaders() });
  }

  getMenuCategories() {
    return this.http.get<MenuCategory[]>(`${this.getApiBase()}/categories`, { headers: this.getHeaders() });
  }

  getMenuItems(categoryId: number | string) {
    return this.http.get<MenuItem[]>(`${this.getApiBase()}/categories/${categoryId}/items`, { headers: this.getHeaders() });
  }

  searchMenuItems(searchTerm: string) {
    const params = new HttpParams().set('searchTerm', searchTerm);
    return this.http.get<MenuItem[]>(`${this.getApiBase()}/items/search`, { headers: this.getHeaders(), params });
  }

  getOrder(tableId: number | string) {
    return this.http.get(`${this.getApiBase()}/orders/${tableId}`, { headers: this.getHeaders() });
  }

  placeOrder(order: OrderItem[], table: TableInfo) {
    return this.http.post(`${this.getApiBase()}/orders`, { order, table }, { headers: this.getHeaders() });
  }

  async loginUser(data: { username?: string; userName?: string; password?: string; deviceId?: string }) {
    const apiHost = this.getApiHost();
    const triedUrls: string[] = [];
    const urls = ['/api/v1/checkUser', '/api/v1/checkuser', '/checkUser', '/checkuser'];
    const preferredName = data.userName ?? data.username ?? '';
    const payloads = [
      { ...data, userName: preferredName },
      { ...data, username: preferredName },
    ];
    const errors: Array<{ status?: number; url: string }> = [];
    const attempts: Array<{ url: string; payload: typeof payloads[number] }> = [];
    for (const url of urls) {
      for (const payload of payloads) {
        attempts.push({
          url: `${apiHost}${url}`,
          payload,
        });
      }
    }

    for (const attempt of attempts) {
      triedUrls.push(attempt.url);
      try {
        return await firstValueFrom(this.http.post(attempt.url, attempt.payload, { headers: this.getHeaders() }));
      } catch (error) {
        const typedError = error as { status?: number };
        errors.push({ status: typedError?.status, url: attempt.url });
      }
    }

    const lastError = errors[errors.length - 1];
    throw {
      status: lastError?.status,
      url: lastError?.url ?? triedUrls[triedUrls.length - 1],
      triedUrls,
      errors,
    };
  }
}
