import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import { first } from 'rxjs/operators';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = false;
  submitted = false;

  constructor(
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private router: Router,
    private apiService: SecurityService,
    private tokenManager: TokenManagerService
  ) {
    this.form = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(8)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }
  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {}

  goToHome() {
    this.router.navigateByUrl('/');
  }
  goToForgotPassword(): void {
    const queryParams = this.route.snapshot.queryParams;
    const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
    this.router.navigate(['/forgot-password'], {
      queryParams: {
        returnUrl: returnUrl,
      },
    });
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    // stop here if form is invalid

    this.apiService
      .login(this.form.value)
      .pipe(first())
      .subscribe({
        next: (data) => {
          console.log(data);
          if (data.accessToken) {
            this.tokenManager.saveAuthToken(data.accessToken);
          }
          const queryParams = this.route.snapshot.queryParams;
          const returnUrl = queryParams.returnUrl ? queryParams.returnUrl : '/';
          this.router.navigateByUrl(returnUrl);
        },
        error: (error) => {
          console.error(error);
          if (error.error && error.error.validationMessage) {
            const validationMessage = error.error.validationMessage;
            if (validationMessage.username) {
              const formControl = this.form.get('username');
              formControl?.setErrors(validationMessage.username);
            }
            if (validationMessage.password) {
              const formControl = this.form.get('password');
              formControl?.setErrors(validationMessage.password);
            }
            if (validationMessage.validation) {
              if (validationMessage.validation.invalid) {
                Swal.fire({
                  icon: 'error',
                  title: 'CREDENTIALS ERROR',
                  text: validationMessage.validation.invalid,
                  allowOutsideClick: true,
                  confirmButtonText: 'CERRAR',
                })
                  .then(() => {
                    return;
                  })
                  .catch((error) => {
                    console.error(error, 'Swal Exception ');
                  });
              }
              if (validationMessage.validation.notVerified) {
                Swal.fire({
                  icon: 'error',
                  title: 'ERROR',
                  text: validationMessage.validation.notVerified,
                  allowOutsideClick: true,
                  confirmButtonText: 'CERRAR',
                })
                  .then(() => {
                    return;
                  })
                  .catch((error) => {
                    console.error(error, 'Swal Exception ');
                  });
              }
            }
          }
          this.loading = false;
        },
      });
  }
}
