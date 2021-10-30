import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SecurityService } from '../../services/security.service';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import { finalize, first } from 'rxjs/operators';
import Swal from 'sweetalert2';

enum EmailStatus {
  Verifying,
  Failed,
  Expired,
  Success,
}
@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css'],
})
export class VerifyEmailComponent implements OnInit {
  EmailStatus = EmailStatus;
  emailStatus = EmailStatus.Verifying;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: SecurityService,
    private tokenManager: TokenManagerService
  ) {}
  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    //todo handle token validation front
    const decoded = this.tokenManager.decodeToken(token);
    if (!decoded.success) {
      if (decoded.expired) {
        this.emailStatus = EmailStatus.Expired;
      } else {
        this.emailStatus = EmailStatus.Failed;
      }
    } else {
      this.router.navigate([], { relativeTo: this.route, replaceUrl: true });
      this.apiService
        .verifyEmail({
          username: decoded.msg.username,
          email: decoded.msg.email,
        })
        .pipe(first())
        .subscribe({
          next: () => {
            this.emailStatus = EmailStatus.Success;
          },
          error: () => {
            this.emailStatus = EmailStatus.Failed;
          },
        });
    }
  }
}
