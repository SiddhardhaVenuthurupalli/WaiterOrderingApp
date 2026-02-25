import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Device } from '@capacitor/device';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { HeaderComponent } from '../components/header/header.component';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [CommonModule, HeaderComponent, IonContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonSpinner],
})
export class LoginPage {
  private readonly http = inject(HttpClient);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  readonly ipAddress = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly showLogin = signal(false);
  readonly checkingIp = signal(false);
  readonly loggingIn = signal(false);

  async submitIp() {
    const ip = this.ipAddress().trim();
    if (!ip) {
      await this.presentToast('Enter a target IP address.', 'warning');
      return;
    }

    this.checkingIp.set(true);
    try {
      const isWeb = window.location.protocol.startsWith('http');
      const headers = isWeb ? new HttpHeaders({ 'x-target-ip': ip }) : undefined;
      const url = isWeb ? '/proxy' : `http://${ip}:5000`;
      const response = await firstValueFrom(this.http.get(url, { headers, responseType: 'text' }));
      if (response?.includes('App Backend Ready')) {
        localStorage.setItem('targetIp', ip);
        this.showLogin.set(true);
        await this.presentToast('Backend connected. Please log in.', 'success');
      } else {
        await this.presentToast('Backend did not respond as expected.', 'danger');
      }
    } catch {
      await this.presentToast('Unable to reach backend.', 'danger');
    } finally {
      this.checkingIp.set(false);
    }
  }

  async login() {
    const username = this.username().trim();
    const password = this.password().trim();
    if (!username || !password) {
      await this.presentToast('Enter username and password.', 'warning');
      return;
    }

    this.loggingIn.set(true);
    try {
      const deviceId = (await Device.getId()).identifier ?? 'web';
      await this.orderService.loginUser({ username, password, deviceId });
      await this.presentToast('Login successful.', 'success');
      await this.router.navigate(['/selectTable']);
    } catch {
      await this.presentToast('Login failed. Please try again.', 'danger');
    } finally {
      this.loggingIn.set(false);
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
