import { repairDoubleEncodedUtf8 } from "../../../scripts/lib/double-encoded-utf8";

describe("repairDoubleEncodedUtf8", () => {
  it("should decode a double-encoded latin-1 letter once", () => {
    expect(repairDoubleEncodedUtf8("KongeÃ¥ Sadelmager ApS")).toEqual({
      value: "Kongeå Sadelmager ApS",
      levels: 1,
    });
  });

  it("should leave a correctly encoded string untouched", () => {
    expect(repairDoubleEncodedUtf8("Söderblomstraat 118")).toEqual({
      value: "Söderblomstraat 118",
      levels: 0,
    });
  });

  it("should leave pure ASCII untouched", () => {
    expect(repairDoubleEncodedUtf8("Heather Lingle")).toEqual({
      value: "Heather Lingle",
      levels: 0,
    });
  });

  it("should decode cp1252 punctuation such as a curly apostrophe", () => {
    expect(repairDoubleEncodedUtf8("Couldnâ€™t see option").value).toBe(
      "Couldn’t see option",
    );
  });

  it("should decode a multi-level encoding all the way down", () => {
    expect(repairDoubleEncodedUtf8("RÃƒÆ’Ã‚Â¶srath")).toEqual({
      value: "Rösrath",
      levels: 3,
    });
  });

  it("should not touch a genuine Ã followed by an ASCII letter", () => {
    expect(repairDoubleEncodedUtf8("SÃO PAULO")).toEqual({
      value: "SÃO PAULO",
      levels: 0,
    });
  });

  it("should not touch characters outside the cp1252 repertoire", () => {
    expect(repairDoubleEncodedUtf8("Ελλάδα").levels).toBe(0);
  });
});
