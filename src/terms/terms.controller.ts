import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { TermsService } from "./terms.service";
import { AppUtils, Term } from "../lib";
import { Converter } from "../converter";
import { SettingsService } from "../settings/settings.service";

@Controller("terms")
export class TermsController {
  constructor(private readonly service: TermsService,
              private readonly settingsService: SettingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.term;
        if (!obj) {
          return reject("Please set term and try again !");
        }
        const term = new Term().toObject(obj);
        const otherTerms = (await this.service.getTermsByOptions({}));
        const settings = await this.settingsService.getSettings();
        if (otherTerms.length >= settings.maximumTermsPerYear) {
          return reject(`You can not exceed the maximum number of terms per year(${settings.maximumTermsPerYear})`);
        }
        const existingNo = otherTerms.find((t) => t.value === term.value);
        if (existingNo && existingNo.id !== term.id) {
          return reject(`Term No is already taken by ${existingNo.name}`);
        }
        const existingName = otherTerms.find((t) => t.name === term.name);
        if (existingName && existingName.id !== term.id) {
          return reject(`Term Name is already taken by Term No ${existingName.value}`);
        }
        return this.service.save(term)
          .then((sup) => resolve(AppUtils.sanitizeObject(sup)))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        let terms = await this.service.getTermsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (terms.length === 0 && create) {
          await this.service.addDefaultTerms();
          terms = await this.service.getTermsByOptions(options || {});
        }
        return resolve(AppUtils.sanitizeObject(terms));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("termId") termId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(termId)) {
          return reject("select term and try again");
        }
        const term = await this.service.getTermById(termId);
        if (!term) {
          return reject("Term not found or was removed !");
        }
        const periods = await this.service.getPeriodsByTermId({ term_id: termId });
        if (periods.length > 0) {
          return reject(`${term.name} is linked to periods`);
        }
        return this.service.deleteManyTerms([termId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
