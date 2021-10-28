import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../services/security/security.service';
import { TokenManagerService } from '../core/services/token-manager.service';
import { first } from 'rxjs/operators';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = false;
  submitted = false;
  private backUrl = '';
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
              const passControl = this.form.get('password');
              passControl?.setErrors(validationMessage.validation);
              const userControl = this.form.get('username');
              userControl?.setErrors(validationMessage.validation);
            }
          }
          this.loading = false;
        },
      });
  }
}
