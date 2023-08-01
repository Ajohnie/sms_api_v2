import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { AppUtils, Setting } from "../lib";
import { Converter } from "../converter";

@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>((resolve, reject) => {
      const bodyObj = Converter.fromBody(body);
      const obj = bodyObj.settings;
      if (!obj) {
        return reject("Please set setting and try again !");
      }
      const setting = new Setting().toObject(obj);
      return this.service.save(setting)
        .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
        .catch((reason) => reject(reason));
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>((resolve, reject) => {
      return this.service.getSettingsByOptions(options || {})
        .then((settings) => {
          return resolve(settings);
        }).catch((reason) => reject(reason));
    });
  }

  @Delete("delete")
  remove(@Query("settingId") settingId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(settingId)) {
          return reject("select setting and try again");
        }
        return this.service.deleteManySettings([settingId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
