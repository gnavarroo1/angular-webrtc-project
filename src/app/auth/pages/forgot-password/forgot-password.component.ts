import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { finalize, first } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
})
export class ForgotPasswordComponent implements OnInit {
  form: FormGroup;
  loading = false;
  submitted = false;
  constructor(
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private router: Router,
    private apiService: SecurityService
  ) {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get f() {
    return this.form.controls;
  }
  ngOnInit(): void {}
  onBack(): void {
    const queryParams = this.route.snapshot.queryParams;
    const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
    this.router.navigateByUrl(returnUrl);
  }
  onSubmit(): void {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    this.apiService
      .forgotPassword(this.form.value)
      .pipe(first())
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          const queryParams = this.route.snapshot.queryParams;
          const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
          Swal.fire({
            title: 'Success',
            text: 'Please check your email for password reset instructions.',
            icon: 'success',
            allowOutsideClick: false,
            confirmButtonText: 'Ok',
          }).then(() => {
            this.router.navigateByUrl(returnUrl);
          });
        },
        error: (error) => {
          const validationMessage = error.error.validationMessage;
          if (validationMessage.email) {
            const formControl = this.form.get('email');
            formControl?.setErrors(validationMessage.email);
          }
        },
      });
  }

  onResendConfirmationEmail() {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    this.apiService
      .resendConfirmationEmail(this.form.value)
      .pipe(first())
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => {
          const queryParams = this.route.snapshot.queryParams;
          const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
          Swal.fire({
            title: 'Success',
            text: data.msg,
            icon: 'warning',
            allowOutsideClick: false,
            confirmButtonText: 'Ok',
          }).then(() => {
            this.router.navigateByUrl(returnUrl);
          });
        },
        error: (error) => {
          const validationMessage = error.error.validationMessage;
          if (validationMessage.email) {
            const formControl = this.form.get('email');
            formControl?.setErrors(validationMessage.email);
          }
        },
      });
  }
}
