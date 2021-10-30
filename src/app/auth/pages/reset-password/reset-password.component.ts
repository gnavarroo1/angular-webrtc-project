import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import { first } from 'rxjs/operators';
import Swal from 'sweetalert2';

enum Status {
  Verifying,
  Failed,
  Expired,
  Success,
}
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  Status = Status;
  status = Status.Verifying;
  form: FormGroup;
  loading = false;
  submitted = false;

  errorMsg = '';
  data: Record<string, any> = {};
  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: SecurityService,
    private tokenManager: TokenManagerService
  ) {
    this.form = this.formBuilder.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      rePassword: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    // if (!token) {
    //   this.status = Status.Failed;
    // }
    const decoded = this.tokenManager.decodeToken(token);
    if (!decoded.success) {
      this.status = Status.Failed;
      this.errorMsg = decoded.msg;
    } else {
      this.status = Status.Success;
      this.data = {
        username: decoded.msg.username,
        email: decoded.msg.email,
      };
    }
    //todo handle token validation front
    this.router.navigate([], { relativeTo: this.route, replaceUrl: true });
  }

  get f() {
    return this.form.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;

    if (this.form.value.password !== this.form.value.rePassword) {
      const formControl = this.form.get('rePassword');
      formControl?.setErrors({
        mismatch: 'Password mismatch',
      });
    }
    this.data = {
      ...this.data,
      password: this.form.value.password,
    };
    this.apiService
      .resetPassword(this.data)
      .pipe(first())
      .subscribe({
        next: (data) => {
          this.loading = false;
          if (data) {
            const queryParams = this.route.snapshot.queryParams;
            const returnUrl = queryParams.returnUrl
              ? queryParams.returnUrl
              : '/';
            Swal.fire({
              title: 'Success',
              text: 'Your passwork has been updated.',
              icon: 'success',
              allowOutsideClick: false,
              confirmButtonText: 'Ok',
            }).then(() => {
              this.router.navigateByUrl(returnUrl);
            });
          }
        },
        error: (error) => {
          if (error.error && error.error.validationMessage) {
            const validationMessage = error.error.validationMessage;
            if (validationMessage.firstName) {
              const formControl = this.form.get('firstName');
              formControl?.setErrors(validationMessage.firstName);
            }
            if (validationMessage.lastName) {
              const formControl = this.form.get('lastName');
              formControl?.setErrors(validationMessage.lastName);
            }
            if (validationMessage.username) {
              const formControl = this.form.get('username');
              formControl?.setErrors(validationMessage.username);
            }
            if (validationMessage.email) {
              const formControl = this.form.get('email');
              formControl?.setErrors(validationMessage.email);
            }
            if (validationMessage.password) {
              const formControl = this.form.get('password');
              formControl?.setErrors(validationMessage.password);
            }
            this.loading = false;
          }
        },
      });
  }
}
