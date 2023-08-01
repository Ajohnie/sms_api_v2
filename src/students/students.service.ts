import { Injectable } from "@nestjs/common";
import { AppRoutes, AppUtils, FirestoreQuery, Result, Student } from "../lib";
import { FireBase } from "../firebase";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { StudentDeletedEvent, StudentEvents, StudentSavedEvent } from "../events/students";

@Injectable()
export class StudentsService {
  private resultsDb = FireBase.getCollection(AppRoutes.results.api.INDEX);
  private studentsDb = FireBase.getCollection(AppRoutes.students.api.INDEX);
  private students: Student[] = [];

  constructor(private eventEmitter: EventEmitter2) {
  }

  getNextStudentNo = () => {
    return new Promise<string>(async (resolve, reject) => {
      // set entity no
      try {
        const getNewEntityNo = async () => {
          let newEntityNo = AppUtils.getOrderNo();
          /*as item become many, this will become inefficient and will need to be removed or optimised
          * if ids are tracked properly, then it is not needed*/
          const entityExists = (nextNo: any) => {
            return this.getStudentsByStudentNo(nextNo).then((found) => found[0]).catch(() => undefined);
          };
          const newEntity = await entityExists(newEntityNo);
          if (newEntity) {
            // keep adding numbers and checking if id exists
            newEntityNo = await getNewEntityNo();
          }
          return newEntityNo;
        };
        const newEntityNo = await getNewEntityNo();
        return resolve(newEntityNo);
      } catch (e) {
        return reject(e);
      }
    });
  };

  save(student: Student) {
    return new Promise<Student>(async (resolve, reject) => {
      try {
        if (!student.hasStudentNo()) {
          student.studentNo = await this.getNextStudentNo();
        }
        await student.validate();
        const sanitized = AppUtils.sanitizeObject(student);
        if (AppUtils.stringIsSet(student.id)) {
          const entityBefore = await this.getStudentById(student.id);
          student.setModified();
          return this.studentsDb.doc(student.id.toString())
            .set(sanitized)
            .then(() => {
              const savedBr = (new Student()).toObject(student);
              const index = this.students.findIndex((prd) => prd.id === savedBr.id);
              if (index > -1) {
                this.students[index] = savedBr;
              } else {
                this.students.push(savedBr);
              }
              this.eventEmitter.emit(StudentEvents.SAVE, new StudentSavedEvent(student, entityBefore));
              return resolve((new Student()).toObject(student));
            })
            .catch((error) => reject(error));
        }
        return this.studentsDb.add(sanitized)
          .then((result) => {
            const newStudent = (new Student()).toObject(student);
            newStudent.id = result.id;
            this.students.push(newStudent);
            this.eventEmitter.emit(StudentEvents.SAVE, new StudentSavedEvent(newStudent, null));
            return resolve(newStudent);
          }).catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  getStudentById(id: string) {
    return new Promise<Student | null>(async (resolve, reject) => {
      try {
        if (typeof id === "object") {
          return reject(`unsupported student record identifier, contact admin`);
        }
        if (!AppUtils.stringIsSet(id)) {
          return reject("provide student identifier");
        }
        const snapshot = await this.studentsDb.doc(id.toString()).get();
        const rawData = snapshot.data();
        if (snapshot.exists && rawData) {
          const student = (new Student()).toObject(rawData);
          student.id = snapshot.id;
          return resolve(student);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getResultsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Result[]>((resolve, reject) => {
      let queryFn = this.resultsDb.orderBy("created");
      const set = new Set<FirestoreQuery>();
      if (AppUtils.stringIsSet(options.student_id)) {
        set.add({ key: "student_id", operator: "==", value: options.student_id });
      }
      if (AppUtils.stringIsSet(options.studentName)) {
        set.add({ key: "studentName", operator: "==", value: options.studentName });
      }
      if (AppUtils.stringIsSet(options.studentNo)) {
        set.add({ key: "studentNo", operator: "==", value: options.studentNo });
      }
      if (AppUtils.stringIsSet(options.level_id)) {
        set.add({ key: "level_id", operator: "==", value: options.level_id });
      }
      if (AppUtils.stringIsSet(options.levelAlias)) {
        set.add({ key: "levelAlias", operator: "==", value: options.levelAlias });
      }
      const year = AppUtils.toNum(options.year);
      if (year > 0) {
        set.add({ key: "year", operator: "==", value: year.toString() });
      }
      // Only a single array-contains clause is allowed in a query
      if (options.subject_ids !== undefined) {
        queryFn = queryFn.where("subject_ids", "array-contains", options.subject_ids);
      }
      if (options.term_ids !== undefined) {
        queryFn = queryFn.where("term_ids", "array-contains", options.term_ids);
      }
      if (options.exam_ids !== undefined) {
        queryFn = queryFn.where("exam_ids", "array-contains", options.exam_ids);
      }
      if (AppUtils.stringIsSet(options.modifiedBy)) {
        set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
      }
      if (AppUtils.stringIsSet(options.date)) {
        const operator = options.dateOperator || "==";
        set.add({ key: "created", operator, value: AppUtils.getShortDate(options.date) });
      }
      queryFn = FireBase.getQueryReference(queryFn, set);
      if (options.startDate && options.endDate) {
        queryFn = FireBase.getEntitiesByDateRange(queryFn,
          options.startDate,
          options.endDate,
          true, "created");
      }
      return queryFn.get().then((snap) => {
        if (snap.empty) {
          return resolve([]);
        }
        const results: Result[] = snap.docs.map((doc) => {
          const result = new Result().toObject(doc.data());
          result.id = doc.id;
          return result;
        });
        return resolve(results);
      }).catch((reason) => reject(reason));
    });
  }

  deleteManyStudents = (studentIds: any[]) => {
    return new Promise<boolean>((resolve, reject) => {
      if (studentIds.length === 0) {
        return reject("select students and try again");
      }
      let batch = this.studentsDb.firestore.batch();
      studentIds.forEach((id) => {
        if (AppUtils.stringIsSet(id)) {
          batch = batch.delete(this.studentsDb.doc(id.toString()));
        }
      });
      return batch.commit().then((result) => {
        studentIds.forEach((id) => {
          if (AppUtils.stringIsSet(id)) {
            const index = this.students.findIndex((prd) => prd.id === id);
            if (index > -1) {
              this.students.splice(index, 1);
            }
            this.eventEmitter.emit(StudentEvents.DELETE, new StudentDeletedEvent(id));
          }
        });
        return resolve(result.length === studentIds.length);
      }).catch((error) => reject(error));
    });
  };

  saveStudents(students: Student[]) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        let batch = this.studentsDb.firestore.batch();
        for (const student of students) {
          if (!student.hasStudentNo()) {
            student.studentNo = await this.getNextStudentNo();
          }
          student.setModified();
          if (!AppUtils.stringIsSet(student.id)) {
            batch = batch.create(this.studentsDb.doc(), AppUtils.sanitizeObject(student));
          } else {
            batch = batch.set(this.studentsDb.doc(student.id.toString()), AppUtils.sanitizeObject(student));
          }
        }
        return batch.commit()
          .then((saved) => {
            this.students.splice(0);
            return resolve(saved.length === students.length);
          })
          .catch((error) => reject(error));
      } catch (e) {
        return reject(e);
      }
    });
  }

  hasStudents() {
    return this.students.length > 0;
  }

  getStudentsByOptions(options: any = {}) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Student[]>(async (resolve, reject) => {
      try {
        if (!AppUtils.hasResponse(options) && this.hasStudents()) {
          console.log(`\n------------using existing ${this.students.length} students---------------\n`);
          // return resolve(this.students);
        }
        const dateFieldName = options.dateOfBirth ? "dateOfBirth" : "created";
        let queryFn = this.studentsDb.orderBy(dateFieldName);
        const set = new Set<FirestoreQuery>();
        if (AppUtils.stringIsSet(options.fname)) {
          set.add({ key: "fname", operator: "==", value: options.fname });
        }
        if (AppUtils.stringIsSet(options.lname)) {
          set.add({ key: "lname", operator: "==", value: options.lname });
        }
        if (AppUtils.stringIsSet(options.levels_stream_id)) {
          set.add({ key: "levels_stream_id", operator: "==", value: options.levels_stream_id });
        }
        if (AppUtils.stringIsSet(options.guardian_id)) {
          set.add({ key: "guardian_id", operator: "==", value: options.guardian_id });
        }
        if (AppUtils.stringIsSet(options.requirement_id)) {
          set.add({ key: "requirement_id", operator: "==", value: options.requirement_id });
        }
        if (AppUtils.stringIsSet(options.fee_id)) {
          set.add({ key: "fee_id", operator: "==", value: options.fee_id });
        }
        if (AppUtils.stringIsSet(options.studentNo)) {
          set.add({ key: "studentNo", operator: "==", value: options.studentNo });
        }
        if (AppUtils.stringIsSet(options.type)) {
          set.add({ key: "type", operator: "==", value: options.type });
        }
        if (AppUtils.stringIsSet(options.status)) {
          set.add({ key: "status", operator: "==", value: options.status });
        }
        if (AppUtils.stringIsSet(options.sex)) {
          set.add({ key: "sex", operator: "==", value: options.sex });
        }
        if (AppUtils.stringIsSet(options.email)) {
          set.add({ key: "email", operator: "==", value: options.email });
        }
        if (AppUtils.stringIsSet(options.address)) {
          set.add({ key: "address", operator: "==", value: options.address });
        }
        if (AppUtils.stringIsSet(options.phoneNo)) {
          set.add({ key: "phoneNo", operator: "==", value: options.phoneNo });
        }
        if (AppUtils.stringIsSet(options.modifiedBy)) {
          set.add({ key: "modifiedBy", operator: "==", value: options.modifiedBy });
        }
        if (AppUtils.stringIsSet(options.date)) {
          const operator = options.dateOperator || "==";
          set.add({ key: dateFieldName, operator, value: AppUtils.getShortDate(options.date) });
        }
        queryFn = FireBase.getQueryReference(queryFn, set);
        if (options.startDate && options.endDate) {
          queryFn = FireBase.getEntitiesByDateRange(queryFn,
            options.startDate,
            options.endDate,
            true, dateFieldName);
        }
        const snap = await queryFn.get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Student[] = snap.docs.map((doc) => {
          const student = new Student().toObject(doc.data());
          student.id = doc.id;
          return student;
        });
        if (!AppUtils.hasResponse(options)) {
          this.students = results;
          console.log(`\n------------loaded ${this.students.length} students successfully---------------\n`);
        }
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }

  getStudentsByStudentNo(studentNo: any) {
    // you need to build indexes for this query, look at the firebase.indexes.json file for details
    return new Promise<Student[]>(async (resolve, reject) => {
      try {
        const snap = await this.studentsDb.where("studentNo", "==", studentNo.toString()).get();
        if (snap.empty) {
          return resolve([]);
        }
        let results: Student[] = snap.docs.map((doc) => {
          const student = new Student().toObject(doc.data());
          student.id = doc.id;
          return student;
        });
        return resolve(results);
      } catch (e) {
        return reject(e);
      }
    });
  }
}

