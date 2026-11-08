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
  selector: 'app-lab-profile',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-title>Profil</mat-card-title>
      <mat-card-content>
        <p id="profile-email">{{ profile?.email }}</p>
        <p id="profile-role">{{ profile?.role }}</p>
        <p id="profile-vip">VIP: {{ profile?.isVip }}</p>
        <p id="profile-balance">Zůstatek: {{ profile?.balance }}</p>
        <mat-form-field>
          <input matInput id="profile-username" [formControl]="username">
        </mat-form-field>
        <button mat-raised-button id="profile-save" type="button" (click)="save()">Uložit jméno</button>
        <p id="profile-message">{{ message }}</p>
      </mat-card-content>
    </mat-card>
  `
})
export class LabProfileComponent implements OnInit {
  private readonly http = inject(HttpClient)
  username = new FormControl('')
  profile: any
  message = ''

  ngOnInit () {
    this.http.get<any>(`${environment.hostServer}/rest/lab/profile`).subscribe({
      next: (body) => {
        this.profile = body.data
        this.username.setValue(body.data?.username ?? '')
      },
      error: (err) => { console.log(err) }
    })
  }

  save () {
    this.http.put<any>(`${environment.hostServer}/rest/lab/profile`, { username: this.username.value }).subscribe({
      next: (body) => {
        this.profile = body.data
        this.message = 'uloženo'
      },
      error: (err) => { this.message = err.error?.message ?? 'chyba' }
    })
  }
}
