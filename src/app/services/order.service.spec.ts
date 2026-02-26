import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(OrderService);
  });

  it('normalizes valid IPv4 addresses', () => {
    expect(service.normalizeTargetIp('192.168.1.10')).toBe('192.168.1.10');
    expect(service.normalizeTargetIp('8.8.8.8')).toBe('8.8.8.8');
  });

  it('rejects invalid IPv4 addresses', () => {
    expect(service.normalizeTargetIp('999.1.1.1')).toBe('');
    expect(service.normalizeTargetIp('abc')).toBe('');
  });
});
