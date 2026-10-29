import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/components/InputError";
import { cn } from "@/lib/utils";
import { TIN_PATTERN } from "../lib/stockOutValidation";

const invalidClass = "border-red-500 focus-visible:ring-red-500";

function RequiredMark() {
    return (
        <span className="text-red-600" aria-hidden="true">
            {" "}*
        </span>
    );
}

function Optional() {
    return <span className="font-normal text-muted-foreground"> (optional)</span>;
}

/**
 * Recipient, issuer and remarks fields shared by the create and edit forms.
 * Each wrapper carries data-field so the form can scroll to the first error.
 */
export default function StockOutRecipientFields({
    data,
    setField,
    errors,
    recipientRequired = false,
    idPrefix = "",
    disabled = false,
}) {
    const id = (name) => `${idPrefix}${name}`;
    const tin = String(data.delivered_to_tin ?? "").trim();
    const tinLooksValid = tin !== "" && TIN_PATTERN.test(tin);

    const textField = (name, label, { placeholder, required = false, optional = false, maxLength, hint } = {}) => (
        <div className="grid gap-2" data-field={name}>
            <Label htmlFor={id(name)}>
                {label}
                {required && <RequiredMark />}
                {optional && <Optional />}
            </Label>
            <Input
                id={id(name)}
                value={data[name] ?? ""}
                onChange={(event) => setField(name, event.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                disabled={disabled}
                aria-required={required || undefined}
                aria-invalid={Boolean(errors[name]) || undefined}
                aria-describedby={hint ? id(`${name}_hint`) : undefined}
                className={cn(errors[name] && invalidClass)}
            />
            {hint && !errors[name] && (
                <p id={id(`${name}_hint`)} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            <InputError message={errors[name]} />
        </div>
    );

    return (
        <>
            {textField("patient_reference", "Customer / Reference", {
                placeholder: "Customer name or reference",
                optional: true,
                maxLength: 255,
            })}

            {textField("delivered_to", "Delivered To", {
                placeholder: "Recipient name / branch / customer",
                required: recipientRequired,
                optional: !recipientRequired,
                maxLength: 255,
                hint: recipientRequired ? "Printed on the Delivery Receipt." : undefined,
            })}

            {textField("delivered_to_tin", "TIN", {
                placeholder: "e.g. 123-456-789-00000",
                optional: true,
                maxLength: 50,
                hint: tinLooksValid
                    ? "TIN format looks good."
                    : "9 digits, dashes optional, plus an optional 3-5 digit branch code.",
            })}

            {textField("delivered_to_address", "Delivered To Address", {
                placeholder: "Delivery address (for the receipt)",
                optional: true,
                maxLength: 500,
            })}

            {textField("issued_by", "Issued By", {
                placeholder: "Issuer name",
                required: true,
                maxLength: 255,
            })}

            <div className="grid gap-2" data-field="remarks">
                <Label htmlFor={id("remarks")}>
                    Remarks
                    <Optional />
                </Label>
                <textarea
                    id={id("remarks")}
                    rows={3}
                    value={data.remarks ?? ""}
                    onChange={(event) => setField("remarks", event.target.value)}
                    placeholder="Optional notes"
                    maxLength={2000}
                    disabled={disabled}
                    aria-invalid={Boolean(errors.remarks) || undefined}
                    className={cn(
                        "flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        errors.remarks && invalidClass,
                    )}
                />
                <InputError message={errors.remarks} />
            </div>
        </>
    );
}
