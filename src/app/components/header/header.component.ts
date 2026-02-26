import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle],
})
export class HeaderComponent {
  @Input() showBack = true;

  private readonly route = inject(ActivatedRoute);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });
  private readonly dataSignal = toSignal(this.route.data, { initialValue: {} });

  readonly title = computed(() => {
    const params = this.queryParams();
    return (
      params.get('TBNAME') ||
      params.get('tableName') ||
      (this.dataSignal() as { title?: string }).title ||
      'Waiter Ordering'
    );
  });
}
