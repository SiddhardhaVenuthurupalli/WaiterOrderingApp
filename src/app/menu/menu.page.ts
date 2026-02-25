import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonItem,
  IonList,
  IonSearchbar,
  IonTextarea,
} from '@ionic/angular/standalone';
import { ModalController, ToastController } from '@ionic/angular';
import { HeaderComponent } from '../components/header/header.component';
import { OrderSummaryComponent } from '../components/order-summary/order-summary.component';
import { MenuCategory, MenuItem, OrderItem, OrderService, TableInfo } from '../services/order.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.page.html',
  styleUrls: ['./menu.page.scss'],
  imports: [
    CommonModule,
    HeaderComponent,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonTextarea,
    IonButton,
    IonBadge,
  ],
})
export class MenuPage implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastController = inject(ToastController);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  readonly tableId = computed(() => this.queryParams().get('tableId') ?? '');
  readonly tableName = computed(() => this.queryParams().get('TBNAME') ?? this.queryParams().get('tableName') ?? '');

  readonly categories = signal<MenuCategory[]>([]);
  readonly items = signal<MenuItem[]>([]);
  readonly previousOrders = signal<OrderItem[]>([]);
  readonly orderStorage = signal<OrderItem[]>([]);
  readonly searchTerm = signal('');
  readonly selectedCategoryId = signal<string | number | null>(null);

  ngOnInit(): void {
    this.loadCategories();
    effect(() => {
      const tableId = this.tableId();
      if (tableId) {
        this.loadOrderHistory(tableId);
      }
    });
  }

  loadCategories() {
    this.orderService.getMenuCategories().subscribe({
      next: (data) => {
        const categories = this.normalizeList<MenuCategory>(data);
        this.categories.set(categories);
        if (categories.length) {
          const id = this.getCategoryId(categories[0]);
          this.selectedCategoryId.set(id);
          this.loadItems(id);
        }
      },
      error: () => this.presentToast('Failed to load categories.', 'danger'),
    });
  }

  loadItems(categoryId: number | string) {
    this.orderService.getMenuItems(categoryId).subscribe({
      next: (data) => this.items.set(this.normalizeList<MenuItem>(data)),
      error: () => this.presentToast('Failed to load menu items.', 'danger'),
    });
  }

  selectCategory(category: MenuCategory) {
    const categoryId = this.getCategoryId(category);
    this.selectedCategoryId.set(categoryId);
    this.searchTerm.set('');
    this.loadItems(categoryId);
  }

  async searchItems(event: CustomEvent) {
    const term = `${event.detail.value ?? ''}`.trim();
    this.searchTerm.set(term);
    if (!term) {
      const currentCategory = this.selectedCategoryId();
      if (currentCategory !== null) {
        this.loadItems(currentCategory);
      }
      return;
    }
    this.orderService.searchMenuItems(term).subscribe({
      next: (data) => this.items.set(this.normalizeList<MenuItem>(data)),
      error: () => this.presentToast('Search failed.', 'danger'),
    });
  }

  getItemQuantity(item: MenuItem) {
    const existing = this.orderStorage().find((entry) => entry.id === this.getItemId(item));
    return existing?.quantity ?? 0;
  }

  getItemRemark(item: MenuItem) {
    const existing = this.orderStorage().find((entry) => entry.id === this.getItemId(item));
    return existing?.remark ?? '';
  }

  updateQuantity(item: MenuItem, delta: number) {
    const itemId = this.getItemId(item);
    const items = [...this.orderStorage()];
    const index = items.findIndex((entry) => entry.id === itemId);
    if (index === -1) {
      if (delta > 0) {
        items.push({
          id: itemId,
          name: item.name,
          price: item.price,
          quantity: delta,
          remark: '',
        });
      }
    } else {
      const updated = { ...items[index], quantity: Math.max(0, items[index].quantity + delta) };
      if (updated.quantity === 0) {
        items.splice(index, 1);
      } else {
        items[index] = updated;
      }
    }
    this.orderStorage.set(items);
  }

  updateRemark(item: MenuItem, remark: string) {
    const itemId = this.getItemId(item);
    const items = [...this.orderStorage()];
    const index = items.findIndex((entry) => entry.id === itemId);
    if (index !== -1) {
      items[index] = { ...items[index], remark };
      this.orderStorage.set(items);
    }
  }

  async openSummary() {
    const modal = await this.modalCtrl.create({
      component: OrderSummaryComponent,
      componentProps: {
        previousOrders: this.previousOrders(),
        currentItems: this.orderStorage(),
      },
    });
    modal.onDidDismiss().then(({ data }) => {
      if (data?.items) {
        this.orderStorage.set(data.items as OrderItem[]);
      }
    });
    await modal.present();
  }

  async placeOrder() {
    if (!this.orderStorage().length) {
      await this.presentToast('Add items before placing an order.', 'warning');
      return;
    }

    const table: TableInfo = {
      id: this.tableId(),
      name: this.tableName(),
    };
    this.orderService.placeOrder(this.orderStorage(), table).subscribe({
      next: async () => {
        await this.presentToast('Order placed successfully.', 'success');
        this.orderStorage.set([]);
        await this.router.navigate(['/selectTable'], {
          queryParams: { refresh: Date.now() },
        });
      },
      error: () => this.presentToast('Unable to place order.', 'danger'),
    });
  }

  loadOrderHistory(tableId: string) {
    this.orderService.getOrder(tableId).subscribe({
      next: (data) => {
        const history = this.normalizeList<OrderItem>(data as OrderItem[] | { items?: OrderItem[]; data?: OrderItem[] });
        this.previousOrders.set(history);
      },
      error: () => this.presentToast('Unable to load previous orders.', 'warning'),
    });
  }

  getCategoryId(category: MenuCategory) {
    return category.id ?? category.name ?? '';
  }

  private getItemId(item: MenuItem) {
    return item.id ?? item.name ?? '';
  }

  private normalizeList<T>(data: T[] | { items?: T[]; data?: T[] } | null | undefined) {
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

  private async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
