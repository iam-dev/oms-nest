import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  FITTER_LOCKED_STATUS_IDS,
  assertFitterMayEditOrders,
  type FitterOrderAccess,
} from "../../../src/enriched-orders/fitter-order-lock";

describe("fitter-order-lock", () => {
  describe("FITTER_LOCKED_STATUS_IDS", () => {
    it("should lock every status reached after approval", () => {
      // 2 Approved, 3/9/10 In Production, 5 Shipped to Fitter, 11 Shipped to
      // Customer, 7 Completed sale, 4 On hold, 6 On trial, 12-14 Inventory
      expect([...FITTER_LOCKED_STATUS_IDS].sort((a, b) => a - b)).toEqual([
        2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14,
      ]);
    });

    it("should leave pre-approval statuses open", () => {
      // 0 Unordered, 1 Ordered, 8 Changed, 15 Awaiting Client Confirmation
      for (const open of [0, 1, 8, 15]) {
        expect(FITTER_LOCKED_STATUS_IDS).not.toContain(open);
      }
    });
  });

  describe("assertFitterMayEditOrders", () => {
    const fitterUser = { legacyId: 83, role: { id: 1, name: "fitter" } };
    const adminUser = { legacyId: 1, role: { id: 2, name: "admin" } };
    let access: jest.Mocked<FitterOrderAccess>;

    beforeEach(() => {
      access = {
        getFitterIdByUserId: jest.fn().mockResolvedValue(49),
        getOrderLockStates: jest.fn(),
      };
    });

    it("should let admins through without any lookup", async () => {
      await expect(
        assertFitterMayEditOrders(access, [1], adminUser),
      ).resolves.toBeUndefined();
      expect(access.getFitterIdByUserId).not.toHaveBeenCalled();
      expect(access.getOrderLockStates).not.toHaveBeenCalled();
    });

    it("should hide another fitter's order behind a 404", async () => {
      access.getOrderLockStates.mockResolvedValue(
        new Map([
          [53810, { fitterId: 274, statusId: 1, statusName: "Ordered" }],
        ]),
      );
      await expect(
        assertFitterMayEditOrders(access, [53810], fitterUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should refuse the fitter's own order once it is On hold", async () => {
      access.getOrderLockStates.mockResolvedValue(
        new Map([
          [51133, { fitterId: 49, statusId: 4, statusName: "On hold" }],
        ]),
      );
      await expect(
        assertFitterMayEditOrders(access, [51133], fitterUser),
      ).rejects.toThrow(
        new ForbiddenException(
          "Fitters cannot edit orders with status: On hold",
        ),
      );
    });

    it("should refuse a batch when any own order is locked", async () => {
      access.getOrderLockStates.mockResolvedValue(
        new Map([
          [1, { fitterId: 49, statusId: 1, statusName: "Ordered" }],
          [2, { fitterId: 49, statusId: 12, statusName: "Inventory Aiken" }],
        ]),
      );
      await expect(
        assertFitterMayEditOrders(access, [1, 2], fitterUser),
      ).rejects.toThrow(
        "Fitters cannot edit orders with status: Inventory Aiken",
      );
    });

    it("should allow the fitter's own pre-approval order", async () => {
      access.getOrderLockStates.mockResolvedValue(
        new Map([
          [1, { fitterId: 49, statusId: 1, statusName: "Ordered" }],
          [
            2,
            {
              fitterId: 49,
              statusId: 15,
              statusName: "Awaiting Client Confirmation",
            },
          ],
        ]),
      );
      await expect(
        assertFitterMayEditOrders(access, [1, 2], fitterUser),
      ).resolves.toBeUndefined();
      expect(access.getOrderLockStates).toHaveBeenCalledWith([1, 2]);
    });

    it("should treat a fitter with no fitter record like any other non-fitter caller", async () => {
      access.getFitterIdByUserId.mockResolvedValue(null);
      await expect(
        assertFitterMayEditOrders(access, [1], fitterUser),
      ).resolves.toBeUndefined();
      expect(access.getOrderLockStates).not.toHaveBeenCalled();
    });
  });
});
