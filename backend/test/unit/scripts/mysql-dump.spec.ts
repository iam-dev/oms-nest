import { parseInsertLine, toPgValue } from "../../../scripts/lib/mysql-dump";

describe("parseInsertLine", () => {
  it("should parse the column list and value tokens of a complete-insert line", () => {
    const line =
      "INSERT INTO `Orders` (`ID`, `Name`, `Deleted`) VALUES (1,'Tom\\'s',NULL);";
    expect(parseInsertLine(line)).toEqual({
      table: "Orders",
      columns: ["ID", "Name", "Deleted"],
      values: ["1", "'Tom\\'s'", "NULL"],
    });
  });

  it("should not let an escaped backslash before a quote swallow the next value", () => {
    const line =
      "INSERT INTO `Orders` (`ID`, `Ref`, `X`) VALUES (1,'CUSTOMER BUCK\\\\','x');";
    expect(parseInsertLine(line)?.values).toEqual([
      "1",
      "'CUSTOMER BUCK\\\\'",
      "'x'",
    ]);
  });

  it("should keep semicolons, commas and parentheses inside a literal", () => {
    const line =
      "INSERT INTO `Orders` (`ID`, `Notes`) VALUES (1,'a;b, (c) d');";
    expect(parseInsertLine(line)?.values).toEqual(["1", "'a;b, (c) d'"]);
  });

  it("should return null for a line that is not an INSERT", () => {
    expect(parseInsertLine("/*!40101 SET NAMES utf8 */;")).toBeNull();
    expect(parseInsertLine("")).toBeNull();
  });
});

describe("toPgValue", () => {
  it("should convert a string literal to PostgreSQL E'' syntax keeping backslash escapes", () => {
    expect(toPgValue("'Tom\\'s \\n ok'", false)).toEqual({
      sql: "E'Tom\\'s \\n ok'",
      repaired: false,
    });
  });

  it("should convert 0 and 1 to booleans for boolean columns", () => {
    expect(toPgValue("0", true).sql).toBe("false");
    expect(toPgValue("1", true).sql).toBe("true");
    expect(toPgValue("NULL", true).sql).toBe("NULL");
  });

  it("should leave numbers and NULL untouched for non-boolean columns", () => {
    expect(toPgValue("42", false).sql).toBe("42");
    expect(toPgValue("-1.5", false).sql).toBe("-1.5");
    expect(toPgValue("NULL", false).sql).toBe("NULL");
  });

  it("should repair double-encoded UTF-8 inside a literal and report it", () => {
    expect(toPgValue("'KongeÃ¥vej 2'", false)).toEqual({
      sql: "E'Kongeåvej 2'",
      repaired: true,
    });
  });
});
