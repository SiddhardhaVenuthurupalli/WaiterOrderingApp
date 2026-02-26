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
    const rawIp = this.ipAddress().trim();
    const ip = this.orderService.normalizeTargetIp(rawIp);
    if (!ip) {
      await this.presentToast('Enter a valid target IP address.', 'warning');
      return;
    }

    this.checkingIp.set(true);
    const isWeb = window.location.protocol.startsWith('http');
    const headers = isWeb ? new HttpHeaders({ 'x-target-ip': ip }) : undefined;
    const url = isWeb ? '/proxy' : `http://${ip}:5000`;
    try {
      const response = await firstValueFrom(this.http.get(url, { headers, responseType: 'text', observe: 'response' }));
      if (response.status >= 200 && response.status < 300) {
        await this.handleBackendReady(ip);
      } else {
        await this.presentToast('Backend responded but is not ready yet.', 'danger');
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status !== undefined && status < 500) {
        await this.handleBackendReady(ip);
        return;
      }
      const message = status ? `Backend check failed (status ${status}).` : 'Unable to reach backend.';
      await this.presentToast(message, 'danger');
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
    } catch (error) {
      const status = (error as { status?: number }).status;
      let message = 'Login failed. Please try again.';
      if (status === 0 || status === undefined) {
        message = 'Network error. Please check your connection.';
      } else if (status === 401) {
        message = 'Invalid username or password.';
      } else if (status === 403) {
        message = 'Access denied. Please contact an administrator.';
      } else if (status >= 500) {
        message = 'Server error. Please try again later.';
      } else if (status) {
        message = `Login failed (status ${status}).`;
      }
      await this.presentToast(message, 'danger');
    } finally {
      this.password.set('');
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

  private async handleBackendReady(ip: string) {
    localStorage.setItem('targetIp', ip);
    this.showLogin.set(true);
    await this.presentToast('Backend connected. Please log in.', 'success');
  }
}
