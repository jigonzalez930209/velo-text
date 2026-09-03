import { OFFICE_STANDARD, OFFICE_THEME, cssToHex6, snapOfficeHex } from "../../dist/core/model/office-colors.js";

test("office-colors: theme is 6x10 and standard is 10", () => {
  assert(OFFICE_THEME.length === 6);
  assert(OFFICE_THEME.every((row) => row.length === 10));
  assert(OFFICE_STANDARD.length === 10);
});

test("office-colors: rgb snaps to palette hex for PDF", () => {
  assert(cssToHex6("rgb(255, 0, 0)") === "#ff0000");
  assert(snapOfficeHex("rgb(255, 0, 0)") === "#ff0000");
  assert(snapOfficeHex("#ffff00") === "#ffff00");
  assert(snapOfficeHex("#111111") === "#000000" || snapOfficeHex("#111111") === "#0d0d0d");
});
