import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

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
    /^(?:(?:10|127)\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3})$/;

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
    return `${this.getApiHost()}/api/v1/Orders`;
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

  normalizeList<T>(data: T[] | { items?: T[]; data?: T[]; recordset?: T[] } | null | undefined): T[] {
    if (Array.isArray(data)) {
      return data;
    }
    if (data?.items) {
      return data.items;
    }
    if (data?.data) {
      return data.data;
    }
    if (data?.recordset) {
      return data.recordset;
    }
    return [];
  }

  private mapStatusValue(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const normalized = `${value}`.trim();
    const code = Number(normalized);
    if (!Number.isNaN(code)) {
      if (code === 0) {
        return 'available';
      }
      if (code === 1) {
        return 'occupied';
      }
      if (code === 2) {
        return 'pendingpayment';
      }
    }
    return normalized;
  }

  private mapCategoryInfo(row: Record<string, unknown>): MenuCategory {
    const id = (row['SNO'] ?? row['id'] ?? row['CATEGORYID'] ?? row['categoryId'] ?? row['categoryID']) as
      | number
      | string
      | undefined;
    const rawName = (row['CATEGORYNAME'] ?? row['CATEGORY'] ?? row['NAME'] ?? row['name']) as string | undefined;
    const name = rawName && rawName.trim() ? rawName.trim() : undefined;
    return {
      id: id as number | string,
      name,
    };
  }

  private mapMenuItemInfo(row: Record<string, unknown>): MenuItem {
    return {
      id: (row['SNO'] ?? row['id'] ?? row['ITEMID'] ?? row['ITEM_ID'] ?? row['itemId'] ?? row['itemID']) as
        | number
        | string,
      name: (row['ITEMNAME'] ?? row['NAME'] ?? row['name'] ?? row['DESCRIPTION']) as string | undefined,
      price: Number(row['RATE'] ?? row['PRICE'] ?? row['price'] ?? row['ITEMPRICE'] ?? row['itemPrice']),
    };
  }

  private mapOrderItemInfo(row: Record<string, unknown>): OrderItem {
    const quantityValue = Number(
      row['ITEMQUANTITY'] ??
        row['ITEM_QUANTITY'] ??
        row['QTY'] ??
        row['QUANTITY'] ??
        row['qty'] ??
        row['quantity'] ??
        row['ORDERQTY'] ??
        row['ORDER_QTY'] ??
        0,
    );
    return {
      id: (row['SNO'] ?? row['id'] ?? row['ITEMID'] ?? row['ITEM_ID'] ?? row['itemId'] ?? row['itemID']) as
        | number
        | string,
      name: (row['ITEMNAME'] ?? row['NAME'] ?? row['name'] ?? row['DESCRIPTION']) as string | undefined,
      price: Number(row['RATE'] ?? row['PRICE'] ?? row['price'] ?? row['ITEMPRICE'] ?? row['itemPrice']),
      quantity: Number.isFinite(quantityValue) ? quantityValue : 0,
      remark: (row['ITEMREMARKS'] ?? row['ITEM_REMARKS'] ?? row['REMARK'] ?? row['REMARKS'] ?? row['COMMENT'] ?? row['COMMENTS']) as
        | string
        | undefined,
    };
  }

  private mapTableInfo(row: Record<string, unknown>): TableInfo {
    return {
      id: (row['SNO'] ?? row['id'] ?? row['TABLEID'] ?? row['tableId'] ?? row['tableID']) as number | string,
      name: (row['TBNAME'] ?? row['BTNNAME'] ?? row['TABLENAME'] ?? row['name']) as string | undefined,
      status: this.mapStatusValue(row['TBSTATUS'] ?? row['status'] ?? row['STATUS']),
    };
  }

  getTables() {
    return this.http.get(`${this.getApiBase()}/tables`, { headers: this.getHeaders() }).pipe(
      map((data) => this.normalizeList<Record<string, unknown>>(data).map((row) => this.mapTableInfo(row))),
    );
  }

  getTableStatus(id: number | string) {
    const params = new HttpParams().set('id', `${id}`);
    return this.http.get(`${this.getApiBase()}/tablestatus`, { headers: this.getHeaders(), params }).pipe(
      map((data) => {
        const [row] = this.normalizeList<Record<string, unknown>>(data);
        if (!row) {
          return { status: undefined } as { status?: string };
        }
        return {
          status: this.mapStatusValue(row['TBSTATUS'] ?? row['status'] ?? row['STATUS']),
        } as { status?: string };
      }),
    );
  }

  getMenuCategories() {
    return this.http.get(`${this.getApiBase()}/categories`, { headers: this.getHeaders() }).pipe(
      map((data) => {
        const categories = this.normalizeList<Record<string, unknown>>(data).map((row) => this.mapCategoryInfo(row));
        const unique = new Map<string, MenuCategory>();
        for (const category of categories) {
          const key = category.id != null ? String(category.id) : '';
          if (key && !unique.has(key)) {
            unique.set(key, category);
          }
        }
        return Array.from(unique.values());
      }),
    );
  }

  getMenuItems(categoryId: number | string) {
    const params = new HttpParams().set('id', `${categoryId}`);
    return this.http.get(`${this.getApiBase()}/menuitems`, { headers: this.getHeaders(), params }).pipe(
      map((data) => this.normalizeList<Record<string, unknown>>(data).map((row) => this.mapMenuItemInfo(row))),
    );
  }

  searchMenuItems(searchTerm: string) {
    const params = new HttpParams().set('searchTerm', searchTerm);
    return this.http.get<MenuItem[]>(`${this.getApiBase()}/items/search`, { headers: this.getHeaders(), params });
  }

  getOrder(tableId: number | string) {
    const params = new HttpParams().set('id', `${tableId}`);
    return this.http.get(`${this.getApiBase()}/order`, { headers: this.getHeaders(), params }).pipe(
      map((data) => this.normalizeList<Record<string, unknown>>(data).map((row) => this.mapOrderItemInfo(row))),
    );
  }

  placeOrder(order: OrderItem[], table: TableInfo) {
    const payload = {
      table: {
        SNO: table.id,
      },
      order: order.map((item) => ({
        ITEMCODE: item.id,
        ITEMNAME: item.name,
        quantity: item.quantity,
        remarks: item.remark ?? '',
      })),
    };
    return this.http.post(`${this.getApiBase()}/neworder`, payload, { headers: this.getHeaders() });
  }

  async loginUser(data: { username?: string; userName?: string; password?: string; deviceId?: string }) {
    const apiHost = this.getApiHost();
    const triedUrls: string[] = [];
    const urls = [
      '/api/v1/Orders/checkUser',
      '/api/v1/Orders/checkuser',
      '/api/v1/checkUser',
      '/api/v1/checkuser',
      '/checkUser',
      '/checkuser',
    ];
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
