/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Component, NgZone, type OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { AddressService } from '../Services/address.service'
import { PaymentService } from '../Services/payment.service'
import { BasketService } from '../Services/basket.service'
import { Router } from '@angular/router'
import { DeliveryService } from '../Services/delivery.service'
import { SnackBarHelperService } from '../Services/snack-bar-helper.service'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { PurchaseBasketComponent } from '../purchase-basket/purchase-basket.component'
import { TranslateModule } from '@ngx-translate/core'

import { MatCardModule } from '@angular/material/card'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-order-summary',
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss'],
  imports: [MatCardModule, TranslateModule, PurchaseBasketComponent, MatButtonModule, MatIconModule]
})
export class OrderSummaryComponent implements OnInit {
  private readonly router = inject(Router)
  private readonly addressService = inject(AddressService)
  private readonly paymentService = inject(PaymentService)
  private readonly basketService = inject(BasketService)
  private readonly deliveryService = inject(DeliveryService)
  private readonly ngZone = inject(NgZone)
  private readonly snackBarHelperService = inject(SnackBarHelperService)

  public bonus = 0
  public itemTotal = 0
  public deliveryPrice = 0
  public promotionalDiscount = 0
  public address: any
  public paymentMethod: any

  ngOnInit (): void {
    this.deliveryService.getById(sessionStorage.getItem('deliveryMethodId')).subscribe((method) => {
      this.deliveryPrice = method.price
    })

    this.addressService.getById(sessionStorage.getItem('addressId')).subscribe({
      next: (address) => {
        this.address = address
      },
      error: (error) => { console.log(error) }
    })

    if (sessionStorage.getItem('paymentId') !== 'wallet') {
      this.paymentService.getById(sessionStorage.getItem('paymentId')).subscribe({
        next: (card) => {
          card.cardNum = String(card.cardNum).substring(String(card.cardNum).length - 4)
          this.paymentMethod = card
        },
        error: (err) => { console.log(err) }
      })
    } else if (sessionStorage.getItem('paymentId') === 'wallet') {
      this.paymentMethod = 'wallet'
    }
  }

  getMessage (total) {
    this.itemTotal = total[0]
    this.promotionalDiscount = sessionStorage.getItem('couponDiscount') ? (parseFloat(sessionStorage.getItem('couponDiscount')) / 100) * this.itemTotal : 0
    this.bonus = total[1]
  }

  placeOrder () {
    const bid = Number(sessionStorage.getItem('bid'))
    this.basketService.find(bid).subscribe({
      next: (basket) => {
        const item = basket?.Products?.[0]
        if (!item) {
          this.snackBarHelperService.open('Basket is empty', 'errorBar')
          return
        }
        this.basketService.labCreateOrder({
          productId: item.id,
          quantity: item.BasketItem?.quantity ?? 1,
          unitPrice: item.price,
          addressId: Number(sessionStorage.getItem('addressId')),
          deliveryMethodId: Number(sessionStorage.getItem('deliveryMethodId'))
        }).subscribe({
          next: (order) => {
            const finish = () => {
              sessionStorage.removeItem('paymentId')
              sessionStorage.removeItem('addressId')
              sessionStorage.removeItem('deliveryMethodId')
              sessionStorage.removeItem('couponDetails')
              sessionStorage.removeItem('couponDiscount')
              this.basketService.updateNumberOfCartItems()
              this.ngZone.run(async () => await this.router.navigate(['/order-history']))
            }
            if (sessionStorage.getItem('paymentId') !== 'wallet') {
              finish()
              return
            }
            this.basketService.labPay(order.publicId).subscribe({
              next: () => {
                this.basketService.labConfirm(order.publicId).subscribe({
                  next: finish,
                  error: (err) => this.snackBarHelperService.open(err.error?.message, 'errorBar')
                })
              },
              error: (err) => this.snackBarHelperService.open(err.error?.message, 'errorBar')
            })
          },
          error: (err) => this.snackBarHelperService.open(err.error?.message, 'errorBar')
        })
      },
      error: (err) => this.snackBarHelperService.open(err.error?.message, 'errorBar')
    })
  }
}
