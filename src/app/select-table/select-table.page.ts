import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter, map } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  readonly tables = signal<TableInfo[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loadTables();
    this.route.queryParamMap
      .pipe(
        map((params) => params.get('refresh') ?? ''),
        distinctUntilChanged(),
        filter((refresh) => refresh !== ''),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadTables());
  }

  loadTables() {
    this.loading.set(true);
    this.orderService.getTables().subscribe({
      next: (data) => {
        const overrides = this.getTableStatusOverrides();
        const tables = this.orderService.normalizeList<TableInfo>(data).map((table) => {
          const override = overrides[`${table.id}`];
          return override ? { ...table, status: override } : table;
        });
        this.tables.set(tables);
      },
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
        const status = this.normalizeStatus(`${statusResponse?.status ?? table.status ?? ''}`);
        if (status.includes('pendingpayment')) {
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
        const status = this.normalizeStatus(`${table.status ?? ''}`);
        if (status.includes('pendingpayment')) {
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
    });
  }

  getStatusClass(table: TableInfo) {
    const status = this.normalizeStatus(`${table.status ?? ''}`);
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

  private normalizeStatus(status: string) {
    return status.toLowerCase().replace(/[\s_-]/g, '');
  }

  private getTableStatusOverrides() {
    try {
      const raw = localStorage.getItem('tableStatusOverrides') ?? '{}';
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
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
