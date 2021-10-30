import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { first } from 'rxjs/operators';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  submitted = false;
  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: SecurityService,
    private tokenManager: TokenManagerService
  ) {
    this.form = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(8)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
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
    this.apiService
      .register(this.form.value)
      .pipe(first())
      .subscribe({
        next: (data) => {
          if (data) {
            // this.tokenManager.saveAuthToken(data.accessToken);
            const queryParams = this.route.snapshot.queryParams;
            const returnUrl = queryParams.returnUrl
              ? queryParams.returnUrl
              : '/';
            Swal.fire({
              title: 'Success',
              text: 'Please check your email for email confirmation. Notice that you need an active email in case you need to recover your password.',
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
