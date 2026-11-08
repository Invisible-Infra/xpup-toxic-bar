/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { UserService } from '../Services/user.service'
import { type AbstractControl, UntypedFormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { MatButtonModule } from '@angular/material/button'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule, MatLabel, MatError, MatHint } from '@angular/material/form-field'
import { MatCardModule } from '@angular/material/card'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  imports: [MatCardModule, TranslateModule, MatFormFieldModule, MatLabel, MatInputModule, FormsModule, ReactiveFormsModule, MatError, MatHint, MatButtonModule]
})
export class ResetPasswordComponent implements OnInit {
  private readonly userService = inject(UserService)
  private readonly route = inject(ActivatedRoute)

  public token = ''
  public passwordControl: UntypedFormControl = new UntypedFormControl('', [Validators.required, Validators.minLength(15), Validators.maxLength(128)])
  public repeatPasswordControl: UntypedFormControl = new UntypedFormControl('', [Validators.required, matchValidator(this.passwordControl)])
  public error?: string
  public confirmation?: string

  ngOnInit (): void {
    this.token = String(this.route.snapshot.queryParamMap.get('token') ?? '')
  }

  resetPassword () {
    this.userService.resetPasswordWithToken(this.token, this.passwordControl.value).subscribe({
      next: () => {
        this.error = undefined
        this.confirmation = 'Heslo bylo změněno. Přihlaste se znovu.'
      },
      error: (error) => {
        this.confirmation = undefined
        this.error = error?.error?.message || 'invalid or expired token'
      }
    })
  }
}

function matchValidator (passwordControl: AbstractControl) {
  return function matchOtherValidate (repeatPasswordControl: UntypedFormControl) {
    if (passwordControl.value !== repeatPasswordControl.value) return { notSame: true }
    return null
  }
}
