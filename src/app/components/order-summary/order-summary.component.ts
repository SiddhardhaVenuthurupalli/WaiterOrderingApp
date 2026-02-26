import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular';
import { OrderItem } from '../../services/order.service';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonFooter,
  ],
})
export class OrderSummaryComponent {
  private readonly modalCtrl = inject(ModalController);

  @Input() set previousOrders(value: OrderItem[] | null | undefined) {
    this.history.set(value ?? []);
  }

  @Input() set currentItems(value: OrderItem[] | null | undefined) {
    this.items.set(value ?? []);
  }

  readonly history = signal<OrderItem[]>([]);
  readonly items = signal<OrderItem[]>([]);

  increment(item: OrderItem) {
    this.updateQuantity(item, 1);
  }

  decrement(item: OrderItem) {
    this.updateQuantity(item, -1);
  }

  dismiss() {
    this.modalCtrl.dismiss({ items: this.items() });
  }

  private updateQuantity(item: OrderItem, delta: number) {
    const items = [...this.items()];
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      if (delta > 0) {
        items.push({ ...item, quantity: delta });
      }
    } else {
      const updated = { ...items[index], quantity: Math.max(0, items[index].quantity + delta) };
      if (updated.quantity === 0) {
        items.splice(index, 1);
      } else {
        items[index] = updated;
      }
    }
    this.items.set(items);
  }
}
