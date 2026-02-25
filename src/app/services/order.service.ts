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

  private isWeb(): boolean {
    return window.location.protocol.startsWith('http');
  }

  private getTargetIp(): string {
    return localStorage.getItem('targetIp') ?? '';
  }

  private getApiHost(): string {
    if (this.isWeb()) {
      return '/proxy';
    }
    const targetIp = this.getTargetIp() || '127.0.0.1';
    return `http://${targetIp}:5000`;
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
    let lastError: { status?: number; url?: string } | undefined;

    for (const url of urls) {
      const fullUrl = `${apiHost}${url}`;
      for (const payload of payloads) {
        triedUrls.push(fullUrl);
        try {
          return await firstValueFrom(this.http.post(fullUrl, payload, { headers: this.getHeaders() }));
        } catch (error) {
          const typedError = error as { status?: number; url?: string };
          lastError = { status: typedError?.status, url: typedError?.url };
        }
      }
    }

    throw {
      status: lastError?.status,
      url: lastError?.url ?? triedUrls[triedUrls.length - 1],
      triedUrls,
    };
  }
}
