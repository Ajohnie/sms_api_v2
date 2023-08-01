export class SettingDeletedEvent {
  settingId: string;

  constructor(settingId: string) {
    this.settingId = settingId;
  }
}