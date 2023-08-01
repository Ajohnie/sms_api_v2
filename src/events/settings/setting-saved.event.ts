import { Setting } from "../../lib";

export class SettingSavedEvent {
  setting: Setting;

  constructor(setting: Setting) {
    this.setting = setting;
  }
}