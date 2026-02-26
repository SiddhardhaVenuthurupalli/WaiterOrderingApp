import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  readonly tableId = computed(() => this.queryParams().get('tableId') ?? '');
  readonly tableName = computed(() => this.queryParams().get('TBNAME') ?? this.queryParams().get('tableName') ?? '');

  readonly categories = signal<MenuCategory[]>([]);
  readonly items = signal<MenuItem[]>([]);
  readonly allItems = signal<MenuItem[]>([]);
  readonly previousOrders = signal<OrderItem[]>([]);
  readonly orderStorage = signal<OrderItem[]>([]);
  readonly searchTerm = signal('');
  readonly selectedCategoryId = signal<string | number | null>(null);

  ngOnInit(): void {
    this.loadCategories();
    toObservable(this.tableId)
      .pipe(
        map((tableId) => tableId ?? ''),
        distinctUntilChanged(),
        filter((tableId) => tableId !== ''),
        switchMap((tableId) =>
          this.orderService.getOrder(tableId).pipe(
            map((data) =>
              this.orderService.normalizeList<OrderItem>(data as OrderItem[] | { items?: OrderItem[]; data?: OrderItem[] }),
            ),
            catchError(() => {
              void this.presentToast('Unable to load previous orders.', 'warning');
              return of<OrderItem[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((history) => this.previousOrders.set(history));
  }

  loadCategories() {
    this.orderService.getMenuCategories().subscribe({
      next: (data) => {
        const categories = this.orderService.normalizeList<MenuCategory>(data);
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
      next: (data) => {
        const items = this.orderService.normalizeList<MenuItem>(data);
        this.allItems.set(items);
        this.items.set(items);
      },
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
    const lowerTerm = term.toLowerCase();
    const filtered = this.allItems().filter((item) => (item.name ?? '').toLowerCase().includes(lowerTerm));
    this.items.set(filtered);
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
      next: async (response) => {
        const message =
          typeof response === 'object' && response && 'message' in response
            ? `${(response as { message?: string }).message ?? 'Order placed successfully.'}`
            : 'Order placed successfully.';
        await this.presentToast(message, 'success');
        this.orderStorage.set([]);
        const overrideId = this.tableId();
        if (overrideId !== '') {
          try {
            const raw = localStorage.getItem('tableStatusOverrides') ?? '{}';
            const overrides = JSON.parse(raw) as Record<string, string>;
            overrides[`${overrideId}`] = 'occupied';
            localStorage.setItem('tableStatusOverrides', JSON.stringify(overrides));
          } catch {
            // Ignore local storage issues.
          }
        }
        const tableId = this.tableId();
        if (tableId !== '') {
          this.orderService.getOrder(tableId).subscribe({
            next: (history) => this.previousOrders.set(history),
            error: () => void this.presentToast('Unable to refresh order summary.', 'warning'),
          });
        }
        await this.router.navigate(['/selectTable'], {
          queryParams: { refresh: Date.now() },
        });
      },
      error: () => this.presentToast('Unable to place order.', 'danger'),
    });
  }

  getCategoryId(category: MenuCategory) {
    return category.id ?? category.name ?? '';
  }

  private getItemId(item: MenuItem) {
    return item.id ?? item.name ?? '';
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
