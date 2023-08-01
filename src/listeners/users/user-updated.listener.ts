import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { UserCreatedEvent, UserEvents, UserUpdatedEvent } from "../../events/users";
import { AppUtils, DefaultPhoto } from "../../lib";
import { FireBase } from "../../firebase";

@Injectable()
export class UserUpdatedListener {
  constructor(private eventEmitter: EventEmitter2) {
  }

  @OnEvent(UserEvents.UPDATE)
  handleUserUpdatedEvent(event: UserUpdatedEvent) {
    const createInstead = () => {
      const photoURL = AppUtils.isUrl(event.photoURL)
        ? event.photoURL
        : DefaultPhoto.MALE;
      const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
      const phoneNumber = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
      const hasPwd = AppUtils.stringIsSet(event.password) && event.password.length >= 6;
      if (!hasPwd) {
        console.log(`can not create new user, due to empty password`);
        return;
      }
      this.eventEmitter.emit(
        UserEvents.CREATE,
        new UserCreatedEvent(
          event.email,
          event.password,
          event.displayName,
          phoneNumber,
          photoURL
        )
      );
    };
    let emailBefore = event.emailBefore;
    if (!AppUtils.stringIsSet(emailBefore)) {
      if (!AppUtils.stringIsSet(event.email)) {
        return;
      }
      emailBefore = event.email;
    }
    FireBase.auth()
      .getUserByEmail(emailBefore)
      .then((record) => {
        const str = "password=";
        const pwd = record.passwordHash.substring((record.passwordHash.indexOf(str) + str.length));
        let password = event.password.toString();
        const hasPwd = AppUtils.stringIsSet(password) && password.length >= 6;
        if (!hasPwd) {
          console.log('using existing password to update user');
          password = pwd;
        }
        // if user exists update else create a new one
        if (record) {
          const photoURL = AppUtils.isUrl(event.photoURL)
            ? event.photoURL
            : DefaultPhoto.MALE;
          const phoneNo = AppUtils.getIntPhoneNo(event.phoneNumber);
          const phoneNumber = AppUtils.stringIsSet(phoneNo) ? phoneNo : null;
          const options: any = {
            email: event.email,
            password,
            displayName: event.displayName,
            photoURL
          };
          if (phoneNumber) {
            options.phoneNumber = phoneNumber;
          }
          FireBase.auth()
            .updateUser(record.uid, options)
            .then(() => console.log(`updated user with email ${event.email}`))
            .catch((reason: any) => {
              console.error("can not update user, creating one instead " + reason);
            });
        } else {
          console.error("user record does not exist, creating one instead ");
          createInstead();
        }
      })
      .catch((error) => {
        console.error("can not update user, creating one instead " + error);
        createInstead();
      });
  }
}
