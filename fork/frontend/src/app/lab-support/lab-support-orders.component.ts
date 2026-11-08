import { Component, type OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-lab-support-orders',
  imports: [MatCardModule, MatButtonModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-title>Objednávky podpory</mat-card-title>
      <mat-card-content>
        @for (order of orders; track order.publicId) {
          <div class="support-order">
            <span>{{ order.publicId }}</span>
            <span>{{ order.status }}</span>
            <span>{{ order.total }}</span>
            <span>{{ order.paidAmount }}</span>
            @if (staff) {
              <button type="button" class="refund-button" (click)="refund(order.publicId)">Vrátit</button>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `
})
export class LabSupportOrdersComponent implements OnInit {
  private readonly http = inject(HttpClient)
  orders: any[] = []
  staff = false

  ngOnInit () {
    this.http.get<any>(`${environment.hostServer}/rest/lab/profile`).subscribe({
      next: (body) => { this.staff = body.data?.role === 'support' || body.data?.role === 'accounting' }
    })
    this.load()
  }

  load () {
    this.http.get<any>(`${environment.hostServer}/rest/lab/orders`).subscribe({
      next: (body) => { this.orders = body.data ?? [] }
    })
  }

  refund (publicId: string) {
    this.http.post(`${environment.hostServer}/rest/support/orders/${publicId}/refund`, {}).subscribe({
      next: () => this.load()
    })
  }
}
