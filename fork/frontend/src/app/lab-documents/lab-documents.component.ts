import { Component, type OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { environment } from '../../environments/environment'
import { MatCardModule } from '@angular/material/card'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-lab-documents',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-title>Dokumenty</mat-card-title>
      <mat-card-content>
        @for (name of files; track name) {
          <button type="button" class="document-link" (click)="open(name)">{{ name }}</button>
        }
        <mat-form-field>
          <input matInput id="document-ref" [formControl]="ref">
        </mat-form-field>
        <button mat-stroked-button type="button" id="document-open" (click)="open(ref.value || '')">Otevřít</button>
        <pre id="document-body">{{ body }}</pre>
      </mat-card-content>
    </mat-card>
  `
})
export class LabDocumentsComponent implements OnInit {
  private readonly http = inject(HttpClient)
  files: string[] = []
  ref = new FormControl('delivery-note.txt')
  body = ''

  ngOnInit () {
    this.http.get<any>(`${environment.hostServer}/rest/documents`).subscribe({
      next: (response) => { this.files = response.data ?? [] }
    })
  }

  open (name: string) {
    this.http.get(`${environment.hostServer}/rest/documents/${encodeURIComponent(name)}`, { responseType: 'text' }).subscribe({
      next: (text) => { this.body = text },
      error: () => { this.body = '' }
    })
  }
}
