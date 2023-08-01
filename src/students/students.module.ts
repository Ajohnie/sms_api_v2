import { Module } from "@nestjs/common";
import { StudentsService } from "./students.service";
import { StudentsController } from "./students.controller";
import { StudentDeletedListener } from "../listeners/students";
import { SettingsModule } from "../settings/settings.module";
import { LevelsStreamsModule } from "../levels-streams/levels-streams.module";
import { GuardiansModule } from "../guardians/guardians.module";
import { ReceiptsModule } from "../receipts/receipts.module";

@Module({
  controllers: [StudentsController],
  imports: [SettingsModule, LevelsStreamsModule, GuardiansModule, ReceiptsModule],
  providers: [
    StudentsService,
    StudentDeletedListener],
  exports: [StudentsService]
})
export class StudentsModule {
}
