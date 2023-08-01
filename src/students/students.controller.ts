import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { StudentsService } from "./students.service";
import { AppUtils, Guardian, Sex, Student, StudentStatus, StudentType } from "../lib";
import { Converter } from "../converter";
import { LevelsStreamsService } from "../levels-streams/levels-streams.service";
import { GuardiansService } from "../guardians/guardians.service";
import { ReceiptsService } from "../receipts/receipts.service";

const Strings = require("@supercharge/strings");
const Gender = require("detect-gender");

@Controller("students")
export class StudentsController {
  constructor(private readonly service: StudentsService,
              private readonly guardiansService: GuardiansService,
              private readonly receiptsService: ReceiptsService,
              private readonly levelStreamService: LevelsStreamsService) {
  }

  @Post("import")
  importStudents(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const params = Converter.fromBody(body);
        const students = params.students;
        const options = params.options;
        if (!Array.isArray(students)) {
          return reject("Empty rows or an unsupported import format");
        }
        const level_stream = await this.levelStreamService.getLevelsStreamById(options.levels_stream_id);
        if (!level_stream) {
          return reject("Selected Level and stream were not found Try again");
        }
        const studentsToSave: Student[] = [];
        for (let index = 0; index < students.length; index++) {
          const entry = students[index];
          const columnNames = Object.keys(new Student());
          const isFirstRow = Object.keys(entry).find((key) => columnNames.indexOf(entry[key]) > -1);
          if (isFirstRow) { // skip first row
            continue;
          }
          const fNameIsSet = AppUtils.stringIsSet(entry.fname);
          if (!fNameIsSet) {
            return reject(`Enter a valid First Name at row ${index + 1} and try again`);
          }
          // note that it stops at only 3 names, any extra names will be disregarded
          const fName = entry.fname.toString();
          const names = Strings(fName).words(); // 0-fname, 1-lname 2- other names
          const lNameIsSet = AppUtils.stringIsSet(entry.lname);
          if (!lNameIsSet) {
            entry.fname = names[0] || "";
            entry.lname = names[1] || "";
            entry.otherNames = names[2] || "";
            if (!AppUtils.stringIsSet(entry.lname)) {
              return reject(`Enter a valid Last Name at row ${index + 1} and try again`);
            }
          }
          const sexOptions = AppUtils.getOptionsFromEnum(Sex);
          const sexIsSet = sexOptions.find((option) => option.value === entry.sex);
          if (!sexIsSet) {
            // return reject(`Enter valid Sex at row ${index + 1} and try again`);
            try {
              const sex = await Gender(entry.lname);
              entry.sex = sex === "male" ? "M" : "F";
            } catch (e) {
              entry.sex = "M";
            }
          }
          const typeOptions = AppUtils.getOptionsFromEnum(StudentType);
          const typeIsSet = typeOptions.find((option) => option.value === entry.type);
          if (!typeIsSet) {
            return reject(`Enter valid Student Type at row ${index + 1} and try again`);
          }
          const statusOptions = AppUtils.getOptionsFromEnum(StudentStatus);
          const statusIsSet = statusOptions.find((option) => option.value === entry.status);
          if (!statusIsSet) {
            return reject(`Enter valid Student Status at row ${index + 1} and try again`);
          }
          const levelIsSet = level_stream.level.alias === entry.levelAlias;
          if (!levelIsSet) {
            return reject(`Enter valid Student Level at row ${index + 1} and try again`);
          }
          const streamIsSet = level_stream.stream.name === entry.streamName;
          if (!streamIsSet) {
            return reject(`Enter valid Student Stream at row ${index + 1} and try again`);
          }
          entry.dateOfBirth = AppUtils.fireDate(entry.dateOfBirth);
          const toSave: Student = (new Student()).toObject(entry);
          toSave.levels_stream_id = level_stream.id;
          toSave.setModified();
          if (AppUtils.stringIsSet(entry.studentNo)) {
            const existingStudent = (await this.service.getStudentsByOptions({
              studentNo: entry.studentNo,
              level_id: level_stream.level_id
            }))[0];
            if (existingStudent) {
              toSave.id = existingStudent.id;
              toSave.studentNo = existingStudent.studentNo;
              toSave.fee_id = existingStudent.fee_id;
              toSave.guardian_id = existingStudent.guardian_id;
              toSave.photo = existingStudent.photo;
            }
          } else {
            /*
            // removed checking by name since students can have similar names
            const existingStudent = (await this.service.getStudentsByOptions({
              studentName: toSave.getName(),
              level_id: level_stream.level_id
            }))[0];
            if (existingStudent) {
              toSave.id = existingStudent.id;
              toSave.studentNo = existingStudent.studentNo;
              toSave.fee_id = existingStudent.fee_id;
              toSave.guardian_id = existingStudent.guardian_id;
              toSave.photo = existingStudent.photo;
            }*/
            /*if (options.matchResults) {
                const results = await getResultsByOptions({
                    studentName: toSave.getName(),
                    level_id: level_stream.level_id
                });
                if (results.length > 0) {
                    const result = results[0];
                    toSave.studentNo = result.studentNo;
                }
            }*/
          }
          studentsToSave.push(toSave);
        }
        /*const value = studentsToSave.length === students.length;
        // no need for updating results. they will be updated on next result input 
        if (value) {
          const resultsToSave: Result[] = [];
          for (const student of studentsToSave) {
            const results = await this.service.getResultsByOptions({
              studentName: student.getName(),
              level_id: level_stream.level_id
            });
            if (results.length > 0) {
              const result = results[0];
              result.studentName = student.getName();
              result.studentNo = student.studentNo;
              resultsToSave.push(result);
            }
          }
          return this.service.saveManyResults(resultsToSave).then(() => resolve(true));
        }*/
        const saved = await this.service.saveStudents(studentsToSave);
        return resolve(saved);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("promote")
  promoteStudents(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const params = Converter.fromBody(body);
        const studentIds = params.student_ids;
        const options = params.options;
        if (!Array.isArray(studentIds)) {
          return reject("select students to promote/demote and try again");
        }
        const level = await this.levelStreamService.getLevelById(options.level_id);
        if (!level) {
          return reject("Selected Level was not found or was removed");
        }
        const promises: Promise<Student | null>[] = studentIds
          .filter((id) => AppUtils.stringIsSet(id))
          .map((id1) => this.service.getStudentById(id1));
        const results = await Promise.all(promises);
        const students: any[] = results.filter((result) => result !== null);
        if (students.length === 0) {
          return reject("select students could not be found or were removed");
        }
        // non need for this variable since level is changed to whatever level is passed
        // const promote = options?.promote?.toString() === "true";
        const previous_level_stream_id = students[0]?.levels_stream_id;
        if (AppUtils.stringIsSet(previous_level_stream_id)) {
          const previous_ls = await this.levelStreamService.getLevelsStreamById(previous_level_stream_id);
          if (!previous_ls) {
            return reject("Current Student Level could not be determined, contact admin");
          }
          if (previous_ls.level_id === options.level_id) {
            return reject(`Students are already in ${level.alias}`);
          }
          const stream_id = previous_ls.stream_id;
          const nextLevelStream = (await this.levelStreamService.getLevelsStreamsByOptions({
            level_id: options.level_id,
            stream_id
          }))[0];
          if (!nextLevelStream) {
            return reject(`${level.alias} does not have stream ${previous_ls.stream.name}`);
          }
          students.forEach((student) => {
            student.setModified();
            student.levels_stream_id = nextLevelStream.id;
            student.levelAlias = nextLevelStream.level.alias;
            student.streamName = nextLevelStream.stream.name;
          });
          return this.service.saveStudents(students)
            .then((value) => resolve(value))
            .catch((reason) => reject(reason));
        } else {
          return reject("Current Student Level could not be determined, contact admin");
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Post("save")
  save(@Body() body: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        const params = Converter.fromBody(body);
        const studentObj = params.student;
        const guardianObj = params.guardian;
        if (!studentObj) {
          return reject("Please Set Student and Try Again!");
        }
        const student = new Student().toObject(studentObj);
        const guardian = (new Guardian()).toObject(guardianObj);
        if (guardianObj) {
          const isGuardianValid = await guardian.validate();
          if (isGuardianValid) {
            const savedGuardian = await this.guardiansService.save(guardian);
            if (savedGuardian) {
              student.guardian_id = savedGuardian.id;
            }
          }
        }
        const saved = await this.service.save(student);
        const student_ids: any[] = params.student_ids || [];
        const photos: any[] = params.photos || [];
        const studentPromises: Promise<Student | null>[] = student_ids
          .filter((id: any) => AppUtils.stringIsSet(id))
          .map((studentId: any) => this.service.getStudentById(studentId));
        if (studentPromises.length > 0) {
          const students = await Promise.all(studentPromises);
          const extraPromises: Promise<any>[] = [];
          for (let index = 0; index < students.length; index++) {
            const pupil = students[index];
            pupil.copy(saved);
            const photo = photos[index];
            if (AppUtils.stringIsSet(photo)) {
              pupil.photo = photo;
            }
            extraPromises.push(this.service.save(pupil));
          }
          await Promise.all(extraPromises);
        }
        return resolve(AppUtils.sanitizeObject(saved));
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Get("findAll")
  findAll(@Query() options: any) {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (AppUtils.stringIsSet(options.level_id)) {
          const levelStreams = await this.levelStreamService.getLevelsStreamsByOptions({ level_id: options.level_id });
          const promises = levelStreams.map((lvs) => {
            return this.levelStreamService.getStudentsByLevelStreamId(lvs.id);
          });
          const results = await Promise.all(promises);
          const allStudents: Student[] = [];
          results.forEach((arr) => allStudents.push(...arr));
          return resolve(allStudents);
        }
        const students = await this.service.getStudentsByOptions(options || {});
        return resolve(students);
      } catch (e) {
        return reject(e);
      }
    });
  }

  @Delete("delete")
  remove(@Query() params: any) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const studentIds = params.studentIds;
        const stId = params.studentId;
        const ids: any[] = [];
        if (AppUtils.stringIsSet(stId)) {
          ids.push(stId);
        } else if (AppUtils.stringIsSet(studentIds)) {
          ids.push(...(studentIds.toString().split(",")));
        } else {
          return reject("select student and try again");
        }
        for (const studentId of ids) {
          const student = await this.service.getStudentById(studentId);
          if (!student) {
            return reject("Student not found or was removed !");
          }
          const receipts = await this.receiptsService.getReceiptsByOptions({ student_id: studentId });
          if (receipts.length > 0) {
            return reject(`${student.getName()} is linked to fees payments`);
          }
          const results = await this.service.getResultsByOptions({ student_id: studentId });
          if (results.length > 0) {
            return reject(`${student.getName()} is linked to student results`);
          }
        }
        return this.service.deleteManyStudents(ids)
          .then((ok) => resolve(ok))
          .catch((reason) => reject(reason));
      } catch (e) {
        return reject(e);
      }
    });
  }
}
