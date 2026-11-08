import { Component, ElementRef, type OnInit, ViewChild, inject, ChangeDetectionStrategy } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-lab-support-desk',
  imports: [MatCardModule, MatButtonModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-title>Podpora</mat-card-title>
      <mat-card-content>
        @for (ticket of tickets; track ticket.id) {
          <button type="button" class="ticket-open" (click)="open(ticket.id)">Ticket {{ ticket.id }}</button>
        }
        <iframe #frame id="ticket-frame" title="Ticket"></iframe>
      </mat-card-content>
    </mat-card>
  `
})
export class LabSupportDeskComponent implements OnInit {
  private readonly http = inject(HttpClient)
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>
  tickets: any[] = []

  ngOnInit () {
    this.http.get<any>(`${environment.hostServer}/rest/support/tickets`).subscribe({
      next: (body) => { this.tickets = body.data ?? [] },
      error: (err) => { console.log(err) }
    })
  }

  open (id: number) {
    this.http.get(`${environment.hostServer}/rest/support/tickets/${id}?format=html`, { responseType: 'text' }).subscribe({
      next: (html) => {
        if (this.frame) this.frame.nativeElement.srcdoc = html
      },
      error: (err) => { console.log(err) }
    })
  }
}
