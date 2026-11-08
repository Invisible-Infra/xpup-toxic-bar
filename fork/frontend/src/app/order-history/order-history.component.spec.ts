import { type ComponentFixture, TestBed } from '@angular/core/testing'
import { of, throwError } from 'rxjs'
import { OrderHistoryComponent } from './order-history.component'
import { BasketService } from '../Services/basket.service'
import { MatCardModule } from '@angular/material/card'

describe('OrderHistoryComponent', () => {
  let fixture: ComponentFixture<OrderHistoryComponent>
  let basketService: any

  beforeEach(async () => {
    basketService = { labOrders: vi.fn().mockReturnValue(of([])) }
    await TestBed.configureTestingModule({
      imports: [MatCardModule, OrderHistoryComponent],
      providers: [{ provide: BasketService, useValue: basketService }]
    }).compileComponents()
    fixture = TestBed.createComponent(OrderHistoryComponent)
  })

  it('shows the empty state when there are no lab orders', () => {
    fixture.detectChanges()
    expect(fixture.componentInstance.emptyState).toBe(true)
    expect((fixture.nativeElement as HTMLElement).querySelector('.emptyState')).toBeTruthy()
  })

  it('shows public id, status, total and paid amount', () => {
    basketService.labOrders.mockReturnValue(of([{ publicId: 'order-a-u', status: 'confirmed', total: 120, paidAmount: 0 }]))
    fixture.detectChanges()
    const text = (fixture.nativeElement as HTMLElement).textContent ?? ''
    expect(text).toContain('order-a-u')
    expect(text).toContain('confirmed')
    expect(text).toContain('120')
    expect(text).toContain('0')
  })

  it('logs an error from the lab order request', () => {
    basketService.labOrders.mockReturnValue(throwError(() => 'Error'))
    console.log = vi.fn()
    fixture.detectChanges()
    expect(console.log).toHaveBeenCalled()
  })
})
