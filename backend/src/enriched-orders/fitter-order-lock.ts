import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleEnum } from "../roles/roles.enum";

/**
 * `statuses.id` values a fitter may no longer edit: everything an order can be
 * in once it has been approved. Admins and supervisors are never restricted.
 *
 *  2 Approved            4 On hold              12 Inventory Aiken
 *  3 In Production P1    5 Shipped to Fitter    13 Inventory UK
 *  9 In Production P2    6 On trial             14 Inventory HOLLAND
 * 10 In Production P3    7 Completed sale
 * 11 Shipped to Customer
 *
 * Still open: 0 Unordered, 1 Ordered, 8 Changed, 15 Awaiting Client
 * Confirmation. Keep `FITTER_RESTRICTED_STATUSES` in
 * `frontend/utils/orderConstants.ts` in step with this list.
 */
export const FITTER_LOCKED_STATUS_IDS: readonly number[] = [
  2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14,
];

export type OrderLockState = {
  fitterId: number | null;
  statusId: number;
  statusName: string;
};

/** The two lookups the check needs; `EnrichedOrdersService` provides both. */
export type FitterOrderAccess = {
  getFitterIdByUserId(legacyUserId: number): Promise<number | null>;
  getOrderLockStates(orderIds: number[]): Promise<Map<number, OrderLockState>>;
};

/** What the JWT guard puts on the request; only the bits scoping needs. */
export type ScopedUser = {
  legacyId?: number;
  role?: { id: number; name?: string };
};

/** True when the caller is scoped as a fitter (everyone else is unrestricted). */
export function isScopedFitter(user?: ScopedUser): boolean {
  return user?.role?.id === RoleEnum.fitter && !!user.legacyId;
}

/**
 * A fitter may only change their own orders, and only before approval.
 * Someone else's order is reported as "not found" (same as the scoped list);
 * an own order in a locked status is forbidden. Anyone who is not a fitter,
 * or a fitter without a `fitters` row, passes through untouched.
 */
export async function assertFitterMayEditOrders(
  access: FitterOrderAccess,
  orderIds: number[],
  user?: ScopedUser,
): Promise<void> {
  if (!isScopedFitter(user)) {
    return;
  }
  const ownFitterId = await access.getFitterIdByUserId(user!.legacyId!);
  if (ownFitterId == null) {
    return;
  }
  const states = await access.getOrderLockStates(orderIds);
  for (const id of orderIds) {
    const state = states.get(id);
    if (!state || state.fitterId !== ownFitterId) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    if (FITTER_LOCKED_STATUS_IDS.includes(state.statusId)) {
      throw new ForbiddenException(
        `Fitters cannot edit orders with status: ${state.statusName}`,
      );
    }
  }
}
