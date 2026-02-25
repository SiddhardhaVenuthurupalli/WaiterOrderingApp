import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonRow,
  IonSpinner,
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { HeaderComponent } from '../components/header/header.component';
import { OrderService, TableInfo } from '../services/order.service';

@Component({
  selector: 'app-select-table',
  standalone: true,
  templateUrl: './select-table.page.html',
  styleUrls: ['./select-table.page.scss'],
  imports: [
    CommonModule,
    HeaderComponent,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonSpinner,
  ],
})
export class SelectTablePage implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  readonly tables = signal<TableInfo[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables() {
    this.loading.set(true);
    this.orderService.getTables().subscribe({
      next: (data) => this.tables.set(this.normalizeList<TableInfo>(data)),
      error: () => this.presentToast('Failed to load tables.', 'danger'),
      complete: () => this.loading.set(false),
    });
  }

  async selectTable(table: TableInfo) {
    const tableId = table.id;
    if (tableId === undefined || tableId === null) {
      await this.presentToast('Table is missing an identifier.', 'warning');
      return;
    }

    this.orderService.getTableStatus(tableId).subscribe({
      next: async (statusResponse) => {
        const status = `${statusResponse?.status ?? table.status ?? ''}`.toLowerCase();
        if (status.includes('pending') && status.includes('payment')) {
          await this.presentToast('This table is pending payment.', 'warning');
          return;
        }
        await this.router.navigate(['/menu'], {
          queryParams: {
            tableId,
            tableName: table.name,
            TBNAME: table.name ?? tableId,
          },
        });
      },
      error: async () => {
        await this.presentToast('Unable to verify table status.', 'danger');
      },
    });
  }

  getStatusClass(table: TableInfo) {
    const status = `${table.status ?? ''}`.toLowerCase();
    if (status.includes('available') || status.includes('free')) {
      return 'bg-success';
    }
    if (status.includes('pending')) {
      return 'bg-warning';
    }
    if (status.includes('occupied') || status.includes('busy')) {
      return 'bg-danger';
    }
    return 'bg-secondary';
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
