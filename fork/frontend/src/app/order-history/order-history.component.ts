/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Component, type OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { BasketService } from '../Services/basket.service'
import { MatCardModule, MatCardTitle, MatCardContent } from '@angular/material/card'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.scss'],
  imports: [MatCardModule, MatCardTitle, MatCardContent]
})
export class OrderHistoryComponent implements OnInit {
  private readonly basketService = inject(BasketService)

  public orders: any[] = []
  public emptyState = true

  ngOnInit (): void {
    this.basketService.labOrders().subscribe({
      next: (orders) => {
        this.orders = orders ?? []
        this.emptyState = this.orders.length === 0
      },
      error: (err) => { console.log(err) }
    })
  }
}
