import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent, UserEvents } from '../../events/users';
import { FireBase } from '../../firebase';
import { AppUtils, DefaultPhoto } from '../../lib';
import { EmailsService } from '../../emails/emails.service';

@Injectable()
export class UserCreatedListener {
  constructor(private emails: EmailsService) {}

  @OnEvent(UserEvents.CREATE)
  handleUserCreatedEvent(event: UserCreatedEvent) {
    const photoURL = AppUtils.isUrl(event.photoURL)
      ? event.photoURL
      : DefaultPhoto.MALE;
    const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
    const phoneNumber = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
    let password = event.password.toString();
    const hasPwd = AppUtils.stringIsSet(password) && password.length >= 6;
    if (!hasPwd) {
      console.error('can not create user with no password');
      console.log(event);
      return;
    }
    FireBase.auth()
      .createUser({
        email: event.email,
        password,
        displayName: event.displayName,
        phoneNumber,
        photoURL,
      })
      .then(() => {
        return this.emails
          .sendPassword(event.displayName, event.email, event.password)
          .then(() =>
            console.log(`sent password to user with email ${event.email}`),
          )
          .catch((reason: any) => {
            console.error("can not send user password, creating one instead " + reason);
          });
      })
      .catch((reason: any) => {
        console.error("can not create user, creating one instead " + reason);
      });
  }
}
