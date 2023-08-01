import { Test, TestingModule } from "@nestjs/testing";
import { GradingsController } from "./gradings.controller";
import { GradingsService } from "./gradings.service";

describe("GradingsController", () => {
  let controller: GradingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradingsController],
      providers: [GradingsService]
    }).compile();

    controller = module.get<GradingsController>(GradingsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
