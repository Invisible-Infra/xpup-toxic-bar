import { Component, inject, ChangeDetectionStrategy } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { environment } from '../../environments/environment'
import { MatCardModule } from '@angular/material/card'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-lab-support-request',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-title>Požadavek na podporu</mat-card-title>
      <mat-card-content>
        <mat-form-field>
          <textarea matInput id="support-message" [formControl]="message"></textarea>
        </mat-form-field>
        <input id="support-file" type="file" (change)="onFile($event)">
        <p id="upload-status">{{ uploadStatus }}</p>
        <mat-form-field>
          <input matInput id="preview-url" placeholder="URL náhledu" [formControl]="previewUrl">
        </mat-form-field>
        <button mat-stroked-button type="button" id="preview-button" (click)="preview()">Náhled odkazu</button>
        <p id="preview-title">{{ previewTitle }}</p>
        <button mat-raised-button type="button" id="support-submit" (click)="submit()" [disabled]="message.invalid">Odeslat</button>
        <p id="support-result">{{ result }}</p>
      </mat-card-content>
    </mat-card>
  `
})
export class LabSupportRequestComponent {
  private readonly http = inject(HttpClient)
  message = new FormControl('', [Validators.required])
  previewUrl = new FormControl('')
  uploadHandle = ''
  uploadStatus = ''
  previewTitle = ''
  result = ''

  onFile (event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    this.http.post<any>(`${environment.hostServer}/rest/uploads`, body).subscribe({
      next: (response) => {
        this.uploadHandle = response.data.handle
        this.uploadStatus = response.data.previewStatus
      },
      error: (err) => { this.uploadStatus = err.error?.message ?? 'upload failed' }
    })
  }

  preview () {
    this.http.post<any>(`${environment.hostServer}/rest/url-preview`, { url: this.previewUrl.value }).subscribe({
      next: (response) => { this.previewTitle = response.data?.title ?? '' },
      error: (err) => { this.previewTitle = err.error?.message ?? '' }
    })
  }

  submit () {
    this.http.post<any>(`${environment.hostServer}/rest/support/tickets`, {
      message: this.message.value,
      uploadHandle: this.uploadHandle || undefined,
      previewUrl: this.previewUrl.value || undefined,
      previewTitle: this.previewTitle || undefined
    }).subscribe({
      next: (response) => { this.result = `ticket ${response.data.id}` },
      error: (err) => { this.result = err.error?.message ?? 'chyba' }
    })
  }
}
