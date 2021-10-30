import { Component, OnInit } from '@angular/core';
import { ApiRestService } from '../../services/api-connection/api-rest.service';
import { TokenManagerService } from '../../../shared/services/token-manager.service';
import { first } from 'rxjs/operators';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  constructor(
    private tokenManagerService: TokenManagerService,
    private apiRestService: ApiRestService,
    private router: Router
  ) {}
  createMeeting() {
    const hasToken = this.tokenManagerService.hasAuthToken();
    if (hasToken && hasToken.hasAuthToken && !hasToken.isExpired) {
      const user = hasToken.user;
      this.apiRestService
        .addMeeting({
          meetingCreatorId: user.sub,
        })
        .pipe(first())
        .subscribe({
          next: (data) => {
            Swal.fire({
              title: 'Success',
              text: 'The meeting was created successfully!',
              icon: 'success',
              allowOutsideClick: false,
              confirmButtonText: 'Go to meeting room',
            }).then(() => {
              this.router.navigateByUrl('/meetings/join/' + data._id);
            });
          },
          error: (error) => {
            console.error(error);
          },
        });
    }
  }
}
