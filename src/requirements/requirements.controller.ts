import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { RequirementsService } from "./requirements.service";
import { AppUtils, Requirement } from "../lib";
import { Converter } from "../converter";

@Controller("requirements")
export class RequirementsController {
  constructor(private readonly service: RequirementsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.requirement;
        if (!obj) {
          return reject("Please set requirement and try again !");
        }
        const requirement = new Requirement().toObject(obj);
        const existingName = await this.service.getRequirementByName(requirement.name);
        if (existingName && existingName.id !== requirement.id) {
          return reject(`Requirement ${existingName.name} already exists`);
        }
        return this.service.save(requirement)
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
        const requirements = await this.service.getRequirementsByOptions(options || {});
        return resolve(requirements);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("requirementId") requirementId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(requirementId)) {
          return reject("select requirement and try again");
        }
        const requirement = await this.service.getRequirementById(requirementId);
        if (!requirement) {
          return reject("Requirement not found or was removed !");
        }
        return this.service.deleteManyRequirements([requirementId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
