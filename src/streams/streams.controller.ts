import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { StreamsService } from "./streams.service";
import { AppUtils, Stream } from "../lib";
import { Converter } from "../converter";
import { SettingsService } from "../settings/settings.service";

@Controller("streams")
export class StreamsController {
  constructor(private readonly service: StreamsService,
              private readonly settingsService: SettingsService) {
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const bodyObj = Converter.fromBody(body);
        const obj = bodyObj.stream;
        if (!obj) {
          return reject("Please set stream and try again !");
        }
        const stream = new Stream().toObject(obj);
        const existingName = await this.service.getStreamByName(stream.name);
        if (existingName && existingName.id !== stream.id) {
          return reject(`Stream Name ${stream.name} is already taken`);
        }
        return this.service.save(stream)
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
        let streams = await this.service.getStreamsByOptions(options || {});
        const create = options?.create?.toString() === "true" || true;
        if (streams.length === 0 && create) {
          await this.service.addDefaultStreams();
          streams = await this.service.getStreamsByOptions(options || {});
        }
        return resolve(streams);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query("streamId") streamId: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        if (!AppUtils.stringIsSet(streamId)) {
          return reject("select stream and try again");
        }
        const stream = await this.service.getStreamById(streamId);
        if (!stream) {
          return reject("Stream not found or was removed !");
        }
        const levelsStreams = await this.service.getLevelsStreamsByStreamId(streamId);
        if (levelsStreams.length > 0) {
          return reject(`${stream.name} is linked to levels`);
        }
        return this.service.deleteManyStreams([streamId])
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
