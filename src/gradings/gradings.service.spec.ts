import { Test, TestingModule } from "@nestjs/testing";
import { GradingsService } from "./gradings.service";

describe("GradingsService", () => {
  let service: GradingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GradingsService]
    }).compile();

    service = module.get<GradingsService>(GradingsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
