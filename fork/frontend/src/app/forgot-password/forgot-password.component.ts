/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { UserService } from '../Services/user.service'
import { UntypedFormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Component, inject, ChangeDetectionStrategy } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { MatButtonModule } from '@angular/material/button'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule, MatLabel, MatError } from '@angular/material/form-field'
import { MatCardModule } from '@angular/material/card'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  imports: [MatCardModule, TranslateModule, MatFormFieldModule, MatLabel, MatInputModule, FormsModule, ReactiveFormsModule, MatError, MatButtonModule]
})
export class ForgotPasswordComponent {
  private readonly userService = inject(UserService)

  public emailControl: UntypedFormControl = new UntypedFormControl('', [Validators.required, Validators.email])
  public error?: string
  public confirmation?: string

  requestLink () {
    this.userService.requestResetLink(this.emailControl.value).subscribe({
      next: (response: any) => {
        this.error = undefined
        this.confirmation = response?.message
      },
      error: (error) => {
        this.confirmation = undefined
        this.error = error?.error?.message || error?.message
      }
    })
  }
}
