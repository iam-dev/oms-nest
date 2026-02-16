import { Test, TestingModule } from "@nestjs/testing";
import { FilesLocalController } from "../../../src/files/infrastructure/uploader/local/files.controller";
import { FilesLocalService } from "../../../src/files/infrastructure/uploader/local/files.service";

describe("FilesLocalController", () => {
  let controller: FilesLocalController;
  let filesService: jest.Mocked<FilesLocalService>;

  beforeEach(async () => {
    const mockFilesService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesLocalController],
      providers: [{ provide: FilesLocalService, useValue: mockFilesService }],
    }).compile();

    controller = module.get<FilesLocalController>(FilesLocalController);
    filesService = module.get(FilesLocalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should call filesService.create with the uploaded file", async () => {
      const mockFile = {
        path: "files/test.png",
        originalname: "test.png",
        mimetype: "image/png",
        size: 1024,
      } as Express.Multer.File;

      const mockResult = {
        file: { id: "uuid-123", path: "/api/v1/files/test.png" },
      };
      filesService.create.mockResolvedValue(mockResult);

      const result = await controller.uploadFile(mockFile);

      expect(result).toEqual(mockResult);
      expect(filesService.create).toHaveBeenCalledWith(mockFile);
    });
  });

  describe("download", () => {
    it("should send file from files directory", () => {
      const mockResponse = {
        sendFile: jest.fn(),
      };

      controller.download("test-file.png", mockResponse);

      expect(mockResponse.sendFile).toHaveBeenCalledWith("test-file.png", {
        root: "./files",
      });
    });
  });
});
