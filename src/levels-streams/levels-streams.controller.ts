import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { AppUtils, LevelsStream } from "../lib";
import { Converter } from "../converter";
import { LevelsStreamsService } from "./levels-streams.service";

@Controller("levels-streams")
export class LevelsStreamsController {
  constructor(private readonly service: LevelsStreamsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.levelsStream;
        if (!obj) {
          return reject("Please set level and try again !");
        }
        const levelStream = new LevelsStream().toObject(obj);
        const existingNo = (await this.service.getLevelsStreamsByOptions(
          {
            level_id: levelStream.level_id,
            stream_id: levelStream.stream_id
          }))[0];
        if (existingNo && existingNo.id !== levelStream.id) {
          return reject(`Levels stream is already taken by ${existingNo.getName()}`);
        }
        return this.service.save(levelStream)
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
        let levelsStreams = await this.service.getLevelsStreamsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (levelsStreams.length === 0 && create) {
          await this.service.addDefaultLevelStreams();
          levelsStreams = await this.service.getLevelsStreamsByOptions(options || {});
        }
        return resolve(levelsStreams);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("levelsStreamId") levelsStreamId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(levelsStreamId)) {
          return reject("select stream and try again");
        }
        const levelsStream = await this.service.getLevelsStreamById(levelsStreamId, true);
        if (!levelsStream) {
          return reject("stream not found or was removed !");
        }
        const students = await this.service.getStudentsByLevelStreamId(levelsStreamId);
        if (students.length > 0) {
          return reject(`${levelsStream.getName()} is linked to students`);
        }
        return this.service.deleteManyLevelsStreams([levelsStreamId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
