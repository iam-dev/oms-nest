/**
 * Account Management endpoints are Supervisor-only.
 *
 * The frontend hides User/Warehouse/Access Filter Group/Country Manager
 * management from Administrators, but the API is the real boundary. This
 * spec pins the @Roles metadata so a future edit cannot silently reopen
 * these controllers to ROLE_ADMIN.
 */
import "reflect-metadata";
import { RoleEnum } from "../../../src/roles/roles.enum";
import { UsersController } from "../../../src/users/users.controller";
import { WarehouseController } from "../../../src/warehouses/warehouse.controller";
import { AccessFilterGroupController } from "../../../src/access-filter-groups/access-filter-group.controller";
import { CountryManagerController } from "../../../src/country-managers/country-manager.controller";

const ACCOUNT_MANAGEMENT_CONTROLLERS = [
  UsersController,
  WarehouseController,
  AccessFilterGroupController,
  CountryManagerController,
];

function rolesOf(target: object): number[] | undefined {
  return Reflect.getMetadata("roles", target);
}

describe("Account Management role boundary", () => {
  it.each(ACCOUNT_MANAGEMENT_CONTROLLERS)(
    "should allow only ROLE_SUPERVISOR on %p at the controller level",
    (controller) => {
      expect(rolesOf(controller)).toEqual([RoleEnum.supervisor]);
    },
  );

  it.each(ACCOUNT_MANAGEMENT_CONTROLLERS)(
    "should have no route handler on %p that re-opens access to ROLE_ADMIN",
    (controller) => {
      const handlers = Object.getOwnPropertyNames(controller.prototype).filter(
        (name) =>
          name !== "constructor" &&
          typeof controller.prototype[name] === "function",
      );
      for (const name of handlers) {
        const handlerRoles = rolesOf(controller.prototype[name]);
        if (handlerRoles) {
          expect(handlerRoles).not.toContain(RoleEnum.admin);
        }
      }
    },
  );
});
