import { Component } from '@angular/core';
import {AbstractControl, FormBuilder, ValidationErrors, ValidatorFn, Validators} from "@angular/forms";
import { Router } from '@angular/router';
@Component({
  selector: 'app-log-in',
  templateUrl: './log-in.component.html',
  styleUrls: ['./log-in.component.css']
})
export class LogInComponent  {
  loading = false;
  submitted = false;

  form = this.fb.group({
    email: ['', {
      validators: [
        Validators.required,
        Validators.email,
      ],
      updateOn: 'blur'
    }],
    validEmail: {
      valid: true,
    },
    password: [
      '',
      [Validators.required, Validators.minLength(8),
        createPasswordStrengthValidator()
      ]
    ]
  });

  constructor(private fb: FormBuilder, private router: Router) { }

  goToRegister() {
    this.router.navigateByUrl('/register');
  }

  goToDashboard(){
    this.router.navigateByUrl('/lobby');
  }

  get email() {
    return this.form.controls['email'];
  }

  get password() {
    return this.form.controls['password'];
  }

  get f() { return this.form.controls; }

  onSubmit() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.form.invalid) {
      return;
    }

    this.goToDashboard();

    this.loading = true;

  }
}

export function createPasswordStrengthValidator(): ValidatorFn {
  return (control:AbstractControl) : ValidationErrors | null => {

    const value = control.value;

    if (!value) {
      return null;
    }

    const hasUpperCase = /[A-Z]+/.test(value);

    const hasLowerCase = /[a-z]+/.test(value);

    const hasNumeric = /[0-9]+/.test(value);

    const passwordValid = hasUpperCase && hasLowerCase && hasNumeric;

    return !passwordValid ? {passwordStrength:true}: null;
  }
}

