"use client";
import { Field } from "./ui";
import { standardSizes } from "../lib/sizing.mjs";
export default function SizeInput({ fields, onChange }) {
  const set = (key, value) => onChange({ ...fields, [key]: value });
  return (
    <fieldset className="size-picker">
      <legend>Size</legend>
      <Field label="Size type">
        {(id) => (
          <select
            id={id}
            value={fields.type}
            onChange={(e) =>
              onChange({
                type: e.target.value,
                value: e.target.value === "Standard" ? "M" : "",
                waist: "",
                inseam: "",
              })
            }
          >
            {["Standard", "Pants", "Numeric", "Shoes", "Custom"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        )}
      </Field>
      {fields.type === "Standard" ? (
        <Field label="Clothing size">
          {(id) => (
            <select
              id={id}
              value={fields.value}
              onChange={(e) => set("value", e.target.value)}
            >
              {standardSizes.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          )}
        </Field>
      ) : fields.type === "Pants" ? (
        <div className="two-col pants-inputs">
          {[
            ["waist", "Waist (inches)", "32"],
            ["inseam", "Inseam (inches)", "30"],
          ].map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  required
                  min="1"
                  max="100"
                  step="0.5"
                  placeholder={placeholder}
                  value={fields[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
      ) : (
        <Field
          label={
            fields.type === "Custom"
              ? "Your size"
              : fields.type === "Shoes"
                ? "Shoe size"
                : "Numeric size"
          }
        >
          {(id) => (
            <input
              id={id}
              required
              maxLength={40}
              type={fields.type === "Custom" ? "text" : "number"}
              inputMode={fields.type === "Custom" ? "text" : "decimal"}
              min="0"
              max="100"
              step="0.5"
              placeholder={
                fields.type === "Custom"
                  ? "e.g. Women's 6, Men's 40R, Youth L"
                  : fields.type === "Shoes"
                    ? "e.g. 9.5"
                    : "e.g. 6"
              }
              value={fields.value}
              onChange={(e) => set("value", e.target.value)}
            />
          )}
        </Field>
      )}
    </fieldset>
  );
}
