import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilesLocalService } from "../../../src/files/infrastructure/uploader/local/files.service";
import { FileRepository } from "../../../src/files/infrastructure/persistence/file.repository";

describe("FilesLocalService", () => {
  let service: FilesLocalService;
  let fileRepository: jest.Mocked<FileRepository>;

  beforeEach(async () => {
    const mockFileRepository = {
      create: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue("api"),
      getOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesLocalService,
        { provide: FileRepository, useValue: mockFileRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FilesLocalService>(FilesLocalService);
    fileRepository = module.get(FileRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a file record and return file object", async () => {
      const mockFile = {
        path: "files/test-file.png",
        originalname: "test.png",
        mimetype: "image/png",
        size: 1024,
      } as Express.Multer.File;

      const mockCreatedFile = {
        id: "uuid-123",
        path: "/api/v1/files/test-file.png",
      };
      fileRepository.create.mockResolvedValue(mockCreatedFile);

      const result = await service.create(mockFile);

      expect(result).toEqual({ file: mockCreatedFile });
      expect(fileRepository.create).toHaveBeenCalledWith({
        path: "/api/v1/files/test-file.png",
      });
    });

    it("should throw UnprocessableEntityException when no file provided", async () => {
      await expect(service.create(null as any)).rejects.toThrow(
        UnprocessableEntityException,
      );

      try {
        await service.create(null as any);
      } catch (error) {
        expect(error.response).toEqual({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { file: "selectFile" },
        });
      }
    });

    it("should throw UnprocessableEntityException when file is undefined", async () => {
      await expect(service.create(undefined as any)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
